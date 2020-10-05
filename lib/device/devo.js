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

  constructor(devDoc, typestore, agent) {
    this.typestore = typestore;
    this.agent = agent;

    // Обязательные поля
    this._id = devDoc._id;
    this.dn = devDoc.dn;
    this.type = devDoc.type && typestore.existsType(devDoc.type) ? devDoc.type : typestore.defaultType;

    // Статические поля - 'name', 'parent'
    Devo.flatFields().forEach(field => {
      this[field] = devDoc[field] || ''; // ??
    });

    // На уровне устройства создать _raw и _aux
    this._raw = {}; // Хранит для каждого свойства:  последнее значение val, ошибка err, время ts, отправитель src
    this._aux = new Map(); // Хранит доп параметры для каждого свойства: min,max,def,dig

    const propsFromDevdoc = devDoc.props || {};
    this.typeobj.proparr.forEach(propItem => {
      this.addProp(propItem.prop, propItem, propsFromDevdoc[propItem.prop]);
    });

    // Сформировать команды по списку команд из типа
    this.typeobj.commands.forEach(command => {
      this[command] = this.doCommand.bind(this, command);
      this._raw[command] = {};
    });

    this.extProps = {};
    this.error = 0;
    this._raw.error = { val: 0 };
  }

  doCommand(command, sender) {
    this.agent.doCommand(this, command, sender);
  }

  setValue(prop, value, sender) {
    const sendObj = this.agent.getWriteChan(this._id, prop);
    if (sendObj) {
      sendObj.command = 'set';
      sendObj.value = value;
      // force?? - сразу установить??
      this.agent.sendDeviceCommand(sendObj);
      return;
    }

    const accepted = this.acceptData({ [prop]: value });
    this.agent.emitDeviceDataAccepted(accepted);
  }

  static flatFields() {
    return ['name', 'parent', 'sys'];
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
    return this.typeobj.props[prop].op;
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
    this._aux.set(prop, { ...typePropItem, ...devPropItem });
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
        const typePropItem = this.typeobj.proparr.find(item => item.prop == prop);

        this.addProp(prop, typePropItem);
      });
    }
  }

  getPropValue(prop) {
    return this[prop];
  }

  getPropTitle(prop) {
    if (!prop) return '';
    if (this.typeobj.props[prop]) return this.typeobj.props[prop].name || prop
    if (this.extProps && this.extProps[prop] && this.extProps[prop].ext) return this.extProps[prop].ext.note;
   
    return 'Unknown prop: '+prop;
  }

  getMin(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).min : null;
  }

  getMax(prop) {
    prop = prop || 'value';
    return this._aux.has(prop) ? this._aux.get(prop).max : null;
  }

  getDefault(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).def : null;
  }

  getDig(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).dig : 0;
  }

  getMu(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).mu : '';
  }

  getRounded(prop, value) {
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
  getPropsForVislink() {
    return Object.keys(this._raw).filter(prop => !this.typeobj.props[prop] || this.typeobj.props[prop].op != 'cmd');

    // return Object.keys(this._raw); // _raw содержит все свойства, включая error
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
      if (upObj[field] != undefined) this[field] = upObj[field];
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
  acceptData(inObj) {
    const accepted = []; // Массив результата
    const ts = inObj.ts || Date.now();

    Object.keys(inObj).forEach(prop => {
      if (this._raw[prop] != undefined) {
        // Несуществующие свойства игнорируются. Свойства ts у устройства быть не должно!!?
        const one = this.acceptOne(prop, ts, inObj[prop]);
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
  acceptOne(prop, ts, val) {
    this._raw[prop].raw = val; // Полученное значение сохраняем как raw
    // Если обработчика нет - значение присвоить напрямую
    return this.acceptNewValue(prop, ts, this.typeobj.props[prop].fn ? this.runHandler(prop, val) : val);
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
   * @param {Object ||  undefined} arg4 - аргумент для calc функции
   *
   * @return { Number || String} - значение свойства как результат работы функции - обработчика
   */
  runHandler(prop, arg3, arg4) {
    try {
      const res = this.typeobj.props[prop].fn(this, prop, arg3, arg4); // возвращает значение или объект

      // Если функция вернула не объект - это значение свойства или undefined
      if (typeof res != 'object') {
        this._raw[prop].err = '';
        this._raw[prop].errts = 0;
        return res;
      }

      // { value, err, timer } - результат работы функции - обработчика
      if (res.error != undefined) {
        this._raw[prop].err = res.error; // Ошибка свойства пишется только в _raw
        this._raw[prop].errts = Date.now();
      } else {
        this._raw[prop].err = '';
        this._raw[prop].errts = 0;
      }

      // Функция может вернуть таймер для запуска
      if (res.timer) {
        this.agent.startTimer(res.timer, this._id, prop);
      }
      return res.value; // это значение свойства или undefined
    } catch (e) {
      // Ошибка при выполнении обработчика - устанавливаем ошибку свойства, ничего не возвращаем
      this._raw[prop].err = 'Handler error: ' + hut.getShortErrStr(e);
      this._raw[prop].errts = Date.now();
    }
  }

  acceptNewValue(prop, ts, newval) {
    if (newval == undefined) return;

    let res;
    this._raw[prop].ts = ts;
    if (this[prop] != newval) {
      this._raw[prop].prev = this[prop];
      this._raw[prop].cts = ts;
      this._raw[prop].val = newval;
      this[prop] = newval; // НОВОЕ ЗНАЧЕНИЕ ЗАПИСАНО В УСТРОЙСТВО
      res = { did: this._id, dn: this.dn, prop, ts, value: newval, changed: 1, prev: this._raw[prop].prev };

      const logObj = { prop, val: newval, ts };
      if (prop == 'error' && newval) logObj.txt = this.getLastErrStr();
      this.agent.logDevice(this._id, logObj);
    } else {
      res = { did: this._id, dn: this.dn, prop, ts, value: newval }; // значение принято, оно не изменилось
    }
    return res;
  }

  getLastErrStr() {
    let result = '';
    let errts = 0;
    Object.keys(this._raw).forEach(prop => {
      // if (this._raw[prop].error && this._raw[prop].errts >= errts) {
      if (this._raw[prop].err) {
        result = this._raw[prop].err;
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
  calcOne(prop, ts, chobj, paramObj) {
    if (this.typeobj.props[prop].fn) {
      return this.acceptNewValue(prop, ts, this.runHandler(prop, chobj, paramObj));
    }
    // если функции нет - ничего не делаем
  }

  /**
   * Запуск функции - обработчика из таймера
   * @param {*} prop
   * @param {*} paramObj { timer: tname }
   */
  runCalcFun(prop, paramObj) {
    const ts = Date.now();

    const one = this.calcOne(prop, ts, null, paramObj);
    const accepted = [];
    if (one) {
      accepted.push(one);
    }

    // TODO Здесь вызов следующих calc по цепочке + обработчик err??
    // Пока только обработчик err
    const errRes = this.updateError(ts);
    if (errRes) {
      accepted.push(errRes);
    }
    // Функция вызвана извне (при сработке таймера) - нужно генерировать событие
    if (accepted.length) this.agent.emitDeviceDataAccepted(accepted);
  }

  getHandler(prop) {
    return this.typeobj.props[prop].fn;
  }

  runCommandHandler(prop, virt) {
    const fn = this.getHandler(prop);
    const now = Date.now();
    try {
      fn(this, prop);
      this._raw[prop].error = '';
      this._raw[prop].errts = 0;
    } catch (e) {
      // Ошибка при выполнении обработчика - заполнить ошибку для функции??
      console.log('Command handler error! ' + hut.getShortErrStr(e));
      this._raw[prop].error = hut.getShortErrStr(e);
      this._raw[prop].errts = now;
    }
    this._raw[prop].ts = now; // Момент последнего выполнения команды
  }

  saveQts(prop, qts) {
    this._raw[prop].qts = qts;
  }

  addExtProps(extPropsForScene, scene) {
    if (!scene || !extPropsForScene) return;
    if (!Array.isArray(extPropsForScene)) extPropsForScene = [extPropsForScene];

    extPropsForScene.forEach(item => {
      // const item = extPropsForScene[prop];
      const prop = item.name;
      if (!this.extProps[prop]) {
        // Свойство уже есть, добавится в список сценариев
        // А если основное свойство - оно останется как есть - оно главное
        this.extProps[prop] = { ext: { ...item }, scenes:[] };
      }
      // Проверить, может уже есть от этого сценария!!
      if (!this.extProps[prop].scenes.includes(scene)) this.extProps[prop].scenes.push(scene);


      if (this[prop] == undefined) {
        // Добавляем новое свойство с дефолтным значением?? Текущее значение позже?

        this[prop] = item.val;
        this._raw[prop] = { raw: item.val, val: item.val, src: 'def' }; // Сохраняем информацию о присваивании
      }
    });
    // console.log('addExtProps '+this._id+' '+util.inspect(this))
  }

  // Возвращает свойства сгруппированные по параметрам: {sceneId:[{prop:prop1,...}], sceneId2:[]}
  getExtPropsByScenes() {
    const res = {};
    Object.keys(this.extProps).forEach(prop => {
        if (this.extProps[prop].scenes.length > 0) {
        const scene = this.extProps[prop].scenes[0]; // Всегда берем первый сценарий, где свойство упоминается
        if (!res[scene]) res[scene] = [];
        res[scene].push(this.extProps[prop].ext);
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
}

// Частные функции модуля

module.exports = Devo;
