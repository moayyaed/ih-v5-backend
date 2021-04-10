/**
 *  devo.js
 *
 *   Объект устройства: {
 *    _id, dn, name, parent, type, <value, state, battery, auto, ...>, error}
 *          - объект содержит значения свойств, доступен по dn из dnSet (для сценариев)??
 *    typeobj: this.typestore.getTypeObj(type)
 *          - ссылка на объект из typestore[type], если тип не определен - на дефолтный тип
 *   _raw: {value:{raw, val, ts, cts, src, err},
 *          auto:{raw, val, ts, cts, src, err}}
 *         - Для каждого свойства сохраняется последнее присваивание:
 *           raw - полученное значение до обработки (применения функции)
 *           val - значение после обработки, оно присваивается объекту на первом уровне
 *           prev - предыдущее значение val
 *           ts - время получения значения
 *           cts - время изменения значения
 *           src - источник
 *           error - ошибка
 *
 *   _aux: Map(key=prop, {min, max, dig,def })
 *         - дополнительные атрибуты свойств
 *    }
 */

const util = require('util');

const hut = require('../utils/hut');

class Devo {
  /**
   * Конструктор устройства как объекта realtime
   * @param {Object} devDoc - запись из таблицы
   * @param {Object} typestore - объект, содержащий типы и операции с ними
   * @param {Object} agent - объект для работы с таймерами, логами и отправки команд плагинам
   */

  constructor(devDoc, typestore, agent, dataObj, chanObj) {
    this.typestore = typestore;
    this.agent = agent;

    // Обязательные поля
    this._id = devDoc._id;
    this.dn = devDoc.dn;
    this.type = devDoc.type && typestore.existsType(devDoc.type) ? devDoc.type : typestore.defaultType;
    this.snipuse = devDoc.snipuse;

    // Статические поля - 'name', 'parent'
    /*
    Devo.flatFields().forEach(field => {
      this[field] = devDoc[field] || ''; // ??
    });
    */

    this.changeFlatFields(devDoc);

    // На уровне устройства создать _raw и _aux
    this._raw = {}; // Хранит для каждого свойства:  последнее значение val, ошибка err, время ts, отправитель src
    this._aux = new Map(); // Хранит доп параметры для каждого свойства: min,max,def,dig
    this.innerLog = [];

    const propsFromDevdoc = devDoc.props || {};
    this.typeobj.proparr.forEach(propItem => {
      this.addProp(propItem.prop, propItem, propsFromDevdoc[propItem.prop]);
      // opt - аргумент для запуска обработчика
      // Если в
      // if (this.typeobj.props[propItem.prop].fn_opt) {

      // }
    });

    // Сформировать команды по списку команд из типа
    this.typeobj.commands.forEach(command => {
      this[command] = this.doCommand.bind(this, command);
      this._raw[command] = { cmd: 1 };
    });

    this.extProps = {};
    this.error = 0;
    this._raw.error = { val: 0 };

    // Присвоить сохраненные значения для параметров и текущие тоже - присвоим все подряд??
    // extProps сформируются позже, но значение уже есть
    /*
    if (dataObj) {
      Object.keys(dataObj).forEach(prop => {
        if (dataObj[prop].val != undefined) {
          this[prop] = dataObj[prop].val;
          this._raw[prop] = dataObj[prop]; // { raw: val, val, ts, src };
        }
      });
    }
    */

    if (dataObj) {
      if (typeof dataObj == 'object') {
        Object.keys(dataObj).forEach(prop => {
          this._raw[prop] = dataObj[prop]; // { raw: val, val, ts, src };
          this[prop] = dataObj[prop].val;
          // Добавляем как первые записи в журнал с флагом boot
          this.innerLog.push({ did: this._id, prop, val: dataObj[prop].val, ts: dataObj[prop].ts, boot: 1 });
        });
        this.changeWithRaw(); // Все обработчики запускаются??
      } else this.innerLog[0] = { boot: 1 };
      // Сформировать пустую запись в журнале, которая указывает позицию записей после загрузки
      // Для заново созданного устройства dataObj=undefined
    }

    // Привязка к каналам
    if (chanObj) {
      Object.keys(chanObj).forEach(prop => {
        if (chanObj[prop].unit && chanObj[prop].chan) {
          this.setChannel(prop, chanObj[prop]);
        }
      });
    }
  }

  // Вернуть слепок устройства на текущий момент для использования в дочернем процессе
  getDevCast() {
    const res = {
      _id: this._id,
      dn: this.dn,
      name: this.name,
      type: this.type,
      parent: this.parent
    };
    res._raw = hut.clone(this._raw);
    return res;
  }

  get location() {
    return this.agent.getLocation(this._id);
  }

  hasChannel(prop) {
    return (this._readSet && this._readSet[prop]) || (this._writeSet && this._writeSet[prop]);
  }

  hasReadChannel(prop) {
    return this._readSet && this._readSet[prop];
  }

  hasWriteChannel(prop) {
    return this._writeSet && this._writeSet[prop];
  }

  getWriteChannel(prop) {
    return this._writeSet && this._writeSet[prop] ? this._writeSet[prop] : '';
  }

  // Возвращает привязку к каналу - м б для чтения или для записи
  getChannelLink(prop) {
    if (this.hasReadChannel(prop)) return this._readSet[prop];
    if (this.hasWriteChannel(prop)) return this._writeSet[prop];
  }

  setChannel(prop, chanObj) {
    const item = { _id: chanObj._id, unit: chanObj.unit, chan: chanObj.chan };
    if (chanObj.w) {
      if (!this._writeSet) this._writeSet = {};
      this._writeSet[prop] = item;
    }
    if (chanObj.r || !chanObj.w) {
      if (!this._readSet) this._readSet = {};
      this._readSet[prop] = item;
    }
  }

  clearChannel(prop) {
    if (!this.hasChannel(prop)) return;
    if (this._readSet && this._readSet[prop]) this._readSet[prop] = '';
    if (this._writeSet && this._writeSet[prop]) this._writeSet[prop] = '';
  }

  doCommand(command, sender) {
    const now = Date.now();
    const logObj = { cmd: command, ts: now - 1, ...sender };
    this.agent.logDevice(this._id, logObj);

    // Если есть обработчик - запускаем его
    if (this.hasHandler(command)) {
      this.runCommandHandler(command);
      return;
    }

    // Нет никакого обработчика, но есть канал - отправить команду напрямую
    if (this.hasWriteChannel(command)) {
      this.writeChannel(command);
      return;
    }

    logObj.ts = now;
    logObj.err = 'Не выполнено! Нужен обработчик или канал!';

    this.agent.logDevice(this._id, logObj);
  }

  writeChannel(prop, val) {
    // console.log('WARN: ' + this.dn + ' writeChannel ' + prop);
    const item = { ...this.getWriteChannel(prop) };
    if (!this.isCommand(prop)) item.command = 'set';
    if (val != undefined) item.value = val;

    // console.log('WARN: ' + this.dn + ' writeChannel item= ' + util.inspect(item));
    this.agent.writeDeviceChannel(this._id, item);
  }

  setValue(prop, val, sender) {
    // sender = { src: 'login:admin' }

    // const logObj = { cmd: 'set', prop, val, ts: Date.now(), ...sender };
    // this.agent.logDevice(this._id, logObj);

    if (this.hasWriteChannel(prop)) {
      this.writeChannel(prop, val);
      // TODO - force??
      return;
    }
    // Изменение значения с запуском calculate других полей
    const accepted = this.acceptData({ [prop]: val }, sender);
    this.agent.emitDeviceDataAccepted(accepted);
  }

  /**
   * Присваивает значение любому свойству (даже calculate) ВИРТУАЛЬНО,  без запуска обработчиков даже без error
   * Должно использоваться в сценариях и обработчиках
   * @param {*} prop
   * @param {*} val
   * @param {*} sender
   */
  assign(prop, val, sender) {
    // sender = { src: 'login:admin' }
    if (this._raw[prop] == undefined) return; // Несуществующие свойства игнорируются.

    // this._raw[prop].raw = val; // Полученное значение сохраняем как raw - может быть и объект {value, error}
    this.setRawErrorFields(prop, val);
    const value = typeof val != 'object' ? val : val.value;
    const ts = Date.now();
    const accepted = [];
    if (value != undefined) {
      this._raw[prop].raw = value; // Полученное значение сохраняем как raw

      const one = this.acceptNewValue(prop, ts, value, sender);
      if (one) accepted.push(one);
    }

    const errRes = this.updateError(ts);
    if (errRes) accepted.push(errRes);

    if (accepted.length) this.agent.emitDeviceDataAccepted(accepted);
  }

  setRawErrorFields(prop, res) {
    // Если функция вернула не объект - это значение свойства или undefined - ошибка сбрасывается
    if (typeof res != 'object') {
      this._raw[prop].err = '';
      this._raw[prop].errts = 0;
    }

    // { value, error} - результат работы функции - обработчика
    if (res.error != undefined) {
      this._raw[prop].err = res.error; // Ошибка свойства пишется только в _raw
      this._raw[prop].errts = Date.now();
    } else {
      this._raw[prop].err = '';
      this._raw[prop].errts = 0;
    }
  }

  static flatFields() {
    return ['name', 'parent', 'sys', 'tags'];
  }

  get typeobj() {
    // Вся информация о структуре, типе данных, ф-и - обработчики - здесь
    return this.typestore.getTypeObj(this.type);
  }

  hasProp(prop) {
    return this._aux.has(prop);
  }

  isWritable(prop) {
    const op = this.getOp(prop);
    return op == 'rw' || op == 'par';
  }

  hasCommand(command) {
    return typeof this[command] == 'function';
  }

  getOp(prop) {
    return this.typeobj.props[prop] ? this.typeobj.props[prop].op : this.extProps[prop] ? 'par' : '';
  }

  isParam(prop) {
    return this.getOp(prop) == 'par';
  }

  /**
   * Добавляет новое свойство в объект _aux вместе с дополнительными атрибутами (min, max,..)
   * Присваивает дефолтное значение свойству
   * @param {String} prop - имя свойства
   * @param {Object} typePropItem - объект из типа
   * @param {Object} devPropItem - объект из устройства -
   *                 дополнительные атрибуты  могут быть переопределены на уровне устройства
   */
  addProp(prop, typePropItem, devPropItem) {
    let save = 0; // По умолчанию вЫключено
    if (devPropItem) {
      if (devPropItem.save != undefined) {
        save = devPropItem.save;
      }
    }

    this._aux.set(prop, { ...typePropItem, ...devPropItem, save });
    const val = this._aux.get(prop).def;

    this[prop] = val;
    this._raw[prop] = { raw: val, val, src: 'def' }; // Сохраняем информацию о присваивании
  }

  /**
   * Удаляет свойство
   * @param {String} prop - имя свойства
   */
  deleteProp(prop) {
    this._aux.delete(prop);
    delete this._raw[prop];
    delete this[prop];
  }

  /**
   * Изменение типа
   * @param {String} type - новый тип
   * @param {Array of string} addedProps - добавленные свойства
   * @param {Array of string} deletedProps - удаленные свойства
   */
  changeType(type, addedProps, deletedProps) {
    this.type = type;
    this.changeTypeProps(addedProps, deletedProps);
  }

  changeTypeProps(addProps, deleteProps) {
    if (deleteProps) {
      deleteProps.forEach(prop => this.deleteProp(prop));
    }

    if (addProps) {
      addProps.forEach(prop => {
        const p = this.typeobj.props[prop];

        if (p.op == 'cmd') {
          this[prop] = this.doCommand.bind(this, prop);
          this._raw[prop] = {};
        } else {
          const typePropItem = this.typeobj.proparr.find(item => item.prop == prop);
          this.addProp(prop, typePropItem);
        }
      });
    }
  }

  getPropValue(inprop) {
    // м б value#string
    if (inprop.indexOf('#string') > 0) {
      const prop = inprop.substr(0, inprop.length - 7);
      return this.formatValue(prop, this[prop]);
    }

    return this[inprop];
  }

  hasFormat(prop) {
    return this.typeobj.props[prop] && this.typeobj.props[prop].fn_format;
  }

  // Вернуть сформатированное значение в виде строки
  formatValue(prop, val) {
    let result = this.applyPropType(prop, val);
    try {
      if (this.typeobj.props[prop] && this.typeobj.props[prop].fn_format) {
        result = this.typeobj.props[prop].fn_format(this, prop, result);
      }
    } catch (e) {
      console.log('ERROR: fn_format for ' + this._id + ' prop=' + prop + util.inspect(e));
    }
    return result;
  }

  getPropTitle(prop) {
    if (!prop) return '';
    if (this.typeobj.props[prop]) return this.typeobj.props[prop].name || prop; // от типа

    if (this.extProps[prop] && this.extProps[prop].scenes && this.extProps[prop].scenes[0]) {
      // от сценария - получить через agent
      return this.agent.getExtpropTitle(this.dn, prop, this.extProps[prop].scenes[0]);
    }

    return prop;
  }

  getPropTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].ts : 0;
  }

  getPropChangeTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].cts : 0;
  }

  getMin(prop) {
    // return this._aux.has(prop) && this._aux.get(prop).min != undefined ? Number(this._aux.get(prop).min) : null;
    return this._aux.has(prop) ? hut.getNumberOrNull(this._aux.get(prop).min) : null;
  }

  getMax(prop) {
    prop = prop || 'value';
    return this._aux.has(prop) ? hut.getNumberOrNull(this._aux.get(prop).max) : null;
    // return this._aux.has(prop) ? this._aux.get(prop).max : null;
  }

  getDefault(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).def : null;
  }

  getDig(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).dig : 0;
  }

  getMu(prop) {
    return this._aux.has(prop) && this._aux.get(prop).mu ? this._aux.get(prop).mu : '';
  }

  getFn_opt_str(prop) {
    // Вернуть для редактирования
    // Если есть параметр в типе - нужно взять в устройстве или в типе
    // Если в типе нет - в устройстве игнорировать
    if (this.typeobj.props[prop].fn_opt_str) {
      const optObj = this._aux.has(prop) ? this._aux.get(prop).fn_opt : '';
      return optObj ? JSON.stringify(optObj) : this.typeobj.props[prop].fn_opt_str;
      // return this.typeobj.props[prop].fn_opt_str;
    }
    return '';
  }

  getFn_opt(prop) {
    // Вернуть при запуске обработчика - объект, только если есть сохраненный, иначе будет дефолтное и все
    return this._aux.has(prop) && this._aux.get(prop).fn_opt ? this._aux.get(prop).fn_opt : {};
  }

  getSave(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).save : 0;
  }

  getRounded(prop, value) {
    if (value == undefined || isNaN(value)) return;
    value = parseFloat(value);
    return Number(value.toFixed(this.getDig(prop)));
  }

  // Получение списков свойств для разных целей - возвращается массив имен свойств
  // Список свойств для привязки к каналу
  // Только из type, calc не брать, command брать, error не брать
  getPropsForHardlink() {
    return Object.keys(this.typeobj.props).filter(prop => this.typeobj.props[prop].op != 'calc');
  }

  // Список свойств для привязки к визуализации
  // type+ext, command не брать, error брать
  // _raw содержит все свойства, включая error
  // Добавить сформатированные свойства value#string, если есть
  getPropsForVislink() {
    const props = Object.keys(this._raw).filter(prop => !this.typeobj.props[prop] || !this.isCommand(prop));
    const res = [];
    props.forEach(prop => {
      res.push(prop);
      if (this.typeobj.props[prop] && this.typeobj.props[prop].format) res.push(prop + '#string');
    });
    return res;
  }

  isCommand(prop) {
    return this.typeobj.props[prop] && this.typeobj.props[prop].op == 'cmd';
  }

  getCommands() {
    return this.typeobj.commands;
  }

  inRange(prop, value) {
    const min = this.getMin(prop);
    const max = this.getMax(prop);
    return (min == null || value >= min) && (max == null || value <= max);
  }

  setAuxProp(prop, aprop, avalue) {
    const aObj = this._aux.has(prop) ? this._aux.get(prop) : {}; // this._aux.value = {min, max, ...}
    aObj[aprop] = avalue;
    this._aux.set(prop, aObj);
  }

  setAuxPropsFromObj(prop, inObj) {
    if (!this._aux.has(prop)) this._aux.set(prop, {}); // this._aux.value = {min, max, ...}
    this._aux.set(prop, Object.assign(this._aux.get(prop), inObj));
    return this._aux.get(prop);
  }

  updateAux(prop, auxprop, auxvalue) {
    if (!this._aux.has(prop)) this._aux.set(prop, {});
    this._aux.get(prop)[auxprop] = auxvalue;
  }

  changeFlatFields(upObj) {
    const fields = Devo.flatFields();
    fields.forEach(field => {
      if (upObj[field] != undefined) {
        if (field == 'tags') {
          this[field] = Array.isArray(upObj[field]) ? '#'+upObj[field].join('#')+'#' : '';
        } else {
          this[field] = upObj[field];
        }
      }
    });
  }

  /**
   * Пересчитать все значения, исходя из raw значения каждого свойства
   *   Используется при изменениях в типе: изменилась функция пересчета, min, max, ...
   * @return {Array of Objects} changed - измененные данные с учетом обработки
   */
  changeWithRaw() {
    const chobj = {};
    Object.keys(this._raw).forEach(prop => {
      if (this._raw[prop].raw != undefined && this.getOp(prop) != 'c') {
        chobj[prop] = this._raw[prop].raw;
      }
    });
    return this.acceptData(chobj);
  }

  /** Прием значений свойств data&parameter
   *  Для каждого свойства используются функции-обработчики из type (при наличии)
   *  Если есть необходимость
   *     - запустить функции для calc свойств
   *     - запустить функцию обработчик свойства error всего устройства
   *
   * @param {Object} inObj - входящие данные (от плагина,...) - изменения свойств для этого устройства
   *                      {value:42, battery:3000, ts:123456789}
   * @return {Array of Objects} - возвращаются все принятые значения, даже не измененные.
   *          Для каждого свойства отдельный элемент массива
   *          Если значение не принято обработчиком - пропускается?
   *          Если значение изменилось - устанавливается флаг changed и prev значение
   *          [{did, dn, prop:'value', val:42, ts, changed:1, prev:41}, {did, dn, prop:'error', value:'', ts} ]
   */
  acceptData(inObj, sender) {
    const accepted = []; // Массив результата
    const ts = inObj.ts || Date.now();

    Object.keys(inObj).forEach(prop => {
      if (this._raw[prop] != undefined && !this.isCommand(prop)) {
        // Несуществующие свойства игнорируются. Свойства ts у устройства быть не должно!!?
        const one = this.acceptOne(prop, ts, inObj[prop], sender);
        if (one) accepted.push(one);
      }
    });

    // Обработка calc свойств   calc = [ { prop: 'state', when: '1', trigger: {value:1,setpont:1} } ]
    let accobj; // Объекты {prop:value, ..}  для использования в calc обработчиках
    let chobj; // формируются в needCalc

    if (this.typeobj.calc.length) {
      this.typeobj.calc.forEach(calcItem => {
        if (needCalc(calcItem)) {
          const one = this.calcOne(calcItem.prop, ts, calcItem.when ? accobj : chobj);
          if (one) accepted.push(one);
        }
      });
    }

    // Обработка error - тоже может быть handler. Пока просто сумма ошибок свойств (OR )
    const one = this.updateError(ts);
    if (one) accepted.push(one);
    // console.log('WARN: '+this.dn+' accepted '+util.inspect(accepted));
    return accepted;

    function needCalc(calcItem) {
      // При изменении
      if (calcItem.when == 0) {
        if (!chobj) {
          chobj = {};
          accepted.forEach(aitem => {
            if (aitem.changed) chobj[aitem.prop] = aitem.value;
          });
        }
        return (
          Object.keys(chobj).length &&
          (!calcItem.trigger || hut.arrayIntersection(Object.keys(chobj), Object.keys(calcItem.trigger)))
        );
      }

      // При поступлении данных
      if (calcItem.when == 1) {
        if (!accobj) {
          accobj = {};
          accepted.forEach(aitem => {
            accobj[aitem.prop] = aitem.value;
          });
        }
        return !calcItem.trigger || hut.arrayIntersection(Object.keys(accobj), Object.keys(calcItem.trigger));
      }
    }
  }

  /**  Прием данных одного свойства
   * При изменении обновляет значение this[prop]
   *
   * @param {String} prop
   * @param {Number} ts
   * @param {Number || String} val
   *
   * @return {Object} - объект для записи в accepted
   *                 {did, dn, prop:'value', val:42, ts, changed:1, prev:41}
   */
  acceptOne(prop, ts, val, sender) {
    this._raw[prop].raw = val; // Полученное значение сохраняем как raw
    // Если обработчика нет - значение присвоить напрямую
    const fn = this.typeobj.props[prop] ? this.typeobj.props[prop].fn : '';
    return this.acceptNewValue(prop, ts, fn ? this.runHandler(prop, val) : val, sender);
    // return this.acceptNewValue(prop, ts, fn ? this.runHandler(prop, val) : this.applyPropType(prop, val), sender);
  }

  applyPropType(prop, val) {
    if (!this.typeobj.props[prop]) return val;

    const vtype = this.typeobj.props[prop].vtype;
    switch (vtype) {
      case 'N':
        return this.getRounded(prop, val);
      case 'B':
        return val == 0 || val == 1 ? Number(val) : undefined;
      case 'S':
        return String(val);
      default:
        return val;
    }
  }

  updateError(ts) {
    // Обработка error - тоже может быть handler. Пока просто сумма ошибок свойств (OR )
    // Для каждого свойства могла быть установлена ошибка в this._raw[prop].err =  'строка с описанием ошибки этого свойства
    // this.error = 1/0
    let newerror = 0;
    Object.keys(this._raw).forEach(prop => {
      newerror = this._raw[prop].err ? 1 : newerror;
    });

    if (this.error != newerror) {
      return this.acceptNewValue('error', ts, newerror);
    }
  }

  /**
   * Запуск функции - обработчика свойства
   * @param {String} prop - имя свойства
   * @param {Object || Number || String} arg3 - аргумент зависит от типа: data - значение, calc - объект со значениями
   *
   * @return { Number || String} - значение свойства как результат работы функции - обработчика
   */
  runHandler(prop, arg3, arg4) {
    try {
      // const arg4 = this.getFn_opt(prop);
      // console.log('getFn_opt = '+arg4)
      const res = this.typeobj.props[prop].fn(this, prop, arg3, arg4); // возвращает значение или объект

      // Если функция вернула не объект - это значение свойства или undefined
      if (typeof res != 'object') {
        this._raw[prop].err = '';
        this._raw[prop].errts = 0;
        return res;
      }

      // { value, error} - результат работы функции - обработчика
      if (res.error != undefined) {
        this._raw[prop].err = res.error; // Ошибка свойства пишется только в _raw
        this._raw[prop].errts = Date.now();
      } else {
        this._raw[prop].err = '';
        this._raw[prop].errts = 0;
      }

      return res.value; // это значение свойства или undefined
    } catch (e) {
      // Ошибка при выполнении обработчика - устанавливаем ошибку свойства, ничего не возвращаем
      console.log('ERROR: ' + this.dn + ' ' + prop + ' handler error: ' + hut.getShortErrStr(e));
      this._raw[prop].err = 'Handler error: ' + hut.getShortErrStr(e);
      this._raw[prop].errts = Date.now();
    }
  }

  /**
   * Прием значения для свойства
   * @param {String} prop
   * @param {Ts} ts
   * @param {*} inval
   * @param {*} sender
   *
   *   - Сохраняет в устройство
   *   - Сохраняет в current и log
   *
   * @return  {Object}
   *          если значение изменилось: { did, dn, prop, ts, value, changed: 1, prev }
   *       если значение НЕ изменилось: { did, dn, prop, ts, value }
   */
  acceptNewValue(prop, ts, inval, sender) {
    if (inval == undefined) return;

    const newval = this.applyPropType(prop, inval);
    const did = this._id;
    this._raw[prop].ts = ts; // Обновляется только время
    if (this[prop] == newval) return { did, dn: this.dn, prop, ts, value: newval };

    const prev = this[prop];
    this._raw[prop].prev = prev;
    this._raw[prop].cts = ts;
    this._raw[prop].val = newval;
    this[prop] = newval; // НОВОЕ ЗНАЧЕНИЕ ЗАПИСАНО В УСТРОЙСТВО

    // Сохранение в devcurrent или devparam
    if (this.isParam(prop) || this.getSave(prop)) {
      this.agent.saveCurrent(this.isParam(prop), { did, prop, ts, val: newval, prev, ...sender });
    }

    // Сохранить в журнал
    if ((prop == 'error' && newval) || this.getSave(prop)) {
      const logObj = { prop, val: newval, ts, ...sender };
      if (prop == 'error') logObj.txt = this.getLastErrStr();
      this.agent.logDevice(did, logObj);
    }
    return { did, dn: this.dn, prop, ts, value: newval, changed: 1, prev };
  }

  /**
   *
   */
  getLastErrStr() {
    let result = '';
    let last = 0;
    Object.keys(this._raw).forEach(prop => {
      if (this._raw[prop].err && this._raw[prop].ts > last) {
        result = this._raw[prop].err;
        last = this._raw[prop].ts;
      }
    });
    return result;
  }

  /**  Calculate одного свойства
   *
   * @param {String} prop
   * @param {Number} ts
   * @param {*} chobj - изменения текущего шага
   *
   * @return {Object} - Возвращает объект для accept массива или undefined
   */
  calcOne(prop, ts, chobj) {
    if (this.typeobj.props[prop].fn) {
      return this.acceptNewValue(prop, ts, this.runHandler(prop, chobj));
    }
    // если функции нет - ничего не делаем
  }

  getHandler(prop) {
    return this.typeobj.props[prop].fn;
  }

  hasHandler(prop) {
    const fn = this.typeobj.props[prop].fn;
    return fn && typeof fn == 'function';
  }

  runCommandHandler(prop) {
    const fn = this.getHandler(prop);

    const now = Date.now();
    try {
      fn(this, prop);
      this._raw[prop].error = '';
      this._raw[prop].errts = 0;
    } catch (e) {
      // Ошибка при выполнении обработчика - заполнить ошибку для функции??
      console.log('ERROR: Command handler error for device ' + this.dn + ' prop ' + prop + ' ' + hut.getShortErrStr(e));
      this._raw[prop].error = hut.getShortErrStr(e);
      this._raw[prop].errts = now;
    }
    this._raw[prop].ts = now; // Момент последнего выполнения команды
  }

  /**
   * Добавление свойств от сценария
   *
   * @param {Array Of Objects} extPropsForScene [{name:'timerOff', val:10, note:'Время ...'}]
   *                 name - имя нового свойства
   * @param {String} sceneId
   *
   *  Выполняется фиксация источника свойства -
   *   1. в this.extProps[prop] = {scenes:[массив sceneId]}
   *        Несколько сценариев могут объявить одно и то же свойство
   *        Свойство у устройства будет удалено, если будут отвязаны все сценарии, которые объявили свойство
   *    А если есть основное свойство с таким именем - оно останется как есть - оно главное
   *
   *   2. Будет добавлено новое свойство устройства this[prop] (+_raw[prop]), если пока не существует
   */
  addExtProps(extPropsForScene, sceneId) {
    if (!sceneId || !extPropsForScene) return;
    if (!Array.isArray(extPropsForScene)) extPropsForScene = [extPropsForScene];

    extPropsForScene.forEach(item => {
      const prop = item.name;
      if (!this.extProps[prop]) this.extProps[prop] = { scenes: [] };
      if (!this.extProps[prop].scenes.includes(sceneId)) this.extProps[prop].scenes.push(sceneId);

      if (this[prop] == undefined) {
        // Если не задано - задаем дефолтное значение
        this[prop] = item.val;
        this._raw[prop] = { raw: item.val, val: item.val, src: 'def' };
      }
    });
  }

  deleteExtProps(scene) {
    if (!scene || !this.extProps) return;
    const propsToDelete = [];
    Object.keys(this.extProps).forEach(prop => {
      // Нужно удалить из массива сценариев
      const pos = this.extProps[prop].scenes.indexOf(scene);
      if (pos >= 0) this.extProps[prop].scenes.splice(pos, 1);

      if (!this.extProps[prop].scenes.length) {
        propsToDelete.push(prop);
      }
    });
    propsToDelete.forEach(prop => {
      delete this.extProps[prop];
      this.deleteProp(prop);
    });
  }

  // Возвращает ext свойства сгруппированные по сценариям: {sceneId:[{prop:prop1,...}], sceneId2:[]}
  getExtPropsByScenes() {
    const res = {};
    Object.keys(this.extProps).forEach(prop => {
      if (this.extProps[prop].scenes.length > 0) {
        const scene = this.extProps[prop].scenes[0]; // Всегда берем первый сценарий, где свойство упоминается
        if (!res[scene]) res[scene] = [];
        const ext = this.agent.getExtprop(this.dn, prop, scene);
        if (ext) res[scene].push(ext);
      }
    });
    return res;
  }

  startAlert(prop, message, level) {
    this.agent.startAlert(this._id, prop, message, level);
  }

  stopAlert(prop) {
    this.agent.stopAlert(this._id, prop);
  }

  startTimer(prop, interval, callback) {
    this.agent.setTimer({ owner: this._id, tname: prop, interval }, callback);
  }

  restartTimer(prop, interval, callback) {
    this.agent.setTimer({ owner: this._id, tname: prop, interval, restart: true }, callback);
  }

  stopTimer(prop) {
    this.agent.clearTimer(this._id, prop);
  }

  log(txt) {
    this.agent.logDevice(this._id, { ts: Date.now(), txt });
  }

  // device.mainlog('Датчик сработал')
  // device.mainlog('Датчик сработал', 2)
  // device.mainlog('Датчик сработал', {level:2, tags:'Климат', location:'/place/dg1'})
  mainlog(txt, opt) {
    if (!txt) return; // Пустые записи не пишем
    let level = 0;
    let tags = this.tags;
    let location = this.location || '';

    if (typeof opt == 'number') opt = { level: opt };

    if (typeof opt != 'object') opt = {};

    const res = { txt, ts: Date.now(), did: this._id, sender: 'DEV:' + this.dn, level, tags, location, ...opt };

    // console.log('MAINLOG: ' + util.inspect(res));
    this.agent.logMain(res);
  }

  /**
   * Подгрузить журнал из лога, если еще не сделано
   */
  async getInnerLog(reverse) {
    if (!this.innerLog.length) return [];

    if (this.innerLog.length < 90 && this.innerLog[0].boot) {
      // Загрузить первый раз из таблицы
      await this.agent.fillInnerLogFromTable(this._id);
    }
    const res = [...this.innerLog];
    return reverse ? res.reverse() : res;
  }
}

// Частные функции модуля

module.exports = Devo;
