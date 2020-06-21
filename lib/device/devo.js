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
 *           err - ошибка
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
    this.type = devDoc.type || typestore.DEFAULT_TYPE;

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
    });
    this._writeChan = {};
  }

  setWriteChan(prop, unit) {
    if (unit) {
      this._writeChan[prop] = unit;
    } else if (this._writeChan[prop]) {
      this._writeChan[prop] = '';
    }
  }

  doCommand(command) {
    console.log('doCommand '+command+' writeChan='+util.inspect(this._writeChan));
    if (this.hasWriteChan(command)) {
      console.log('direct '+command);

      // { unit, did, prop, value, command }
      this.agent.sendCommand({unit: this._writeChan[command], did:this._id, command});
      // Отправить команду плагину
      // Если force - нужно также выполнить виртуальную команду через set. 
      // Но при этом метод set не должен отправить второй раз, так как свойство тоже м б связано с каналом для записи???
      return 'direct ' + command;
    }

    console.log('virt '+command);

    if (this.typeobj.props[command].fn) {
      try {
        this.typeobj.props[command].fn(this, command);
        return 'OK virt ' + command;
      } catch (e) {
        // Ошибка при выполнении обработчика
        console.log('Command handler error! ' + hut.getShortErrStr(e));
      }
    }
  }

  set(prop, value) {
    console.log('SET ' + prop + '=' + value);
    if (this.hasWriteChan(prop)) {
      //
    }
    const ts = Date.now();
    const res = this.changeOne(prop, ts, value);
    if (res.val != undefined) {
      const changed = [{ did: this._id, dn: this.dn, prop, value: res.val, ts }];
      this.agent.emitDeviceDataChanged(changed);
    }
  }

  hasWriteChan(prop) {
    return this._writeChan[prop];
  }

  static flatFields() {
    return ['name', 'parent'];
  }

  get typeobj() {
    // Вся информация о структуре, типе данных, ф-и - обработчики - здесь
    return this.typestore.getTypeObj(this.type);
  }

  hasProp(prop) {
    return this._aux.has(prop);
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

  setPropValue(prop, value) {
    this[prop] = value;
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

  getRounded(prop, value) {
    return Number(value.toFixed(this.getDig(prop)));
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
    return this.change(chobj);
  }

  /** Изменение значения свойств
   *  Для каждого свойства используются функции-обработчики из type (при наличии)
   *  Если есть изменения - запустить функции для calc свойств
   *  В конце, при необходимости - запустить функцию обработчик свойства error всего устройства
   *
   * @param {Object} inObj - входящие данные (от плагина,...) - изменения свойств для этого устройства
   *                      {value:42, battery:3000, ts:123456789}
   * @return {Array of Objects} changed - только измененные данные с учетом обработки
   *                      [{did, dn, prop:'value', val:42, ts}, {did, dn, prop:'error', value:'', ts} ]
   */
  change(inObj) {
    const changed = []; // Массив изменений для возврата
    const chobj = {}; // Объект изменений для использования в обработке
    let errChanged; // Флаг изменения ошибки в целом по устройству

    const ts = inObj.ts || Date.now();

    // Обработка полученных свойств
    Object.keys(inObj).forEach(prop => {
      if (this._raw[prop] != undefined) {
        // Несуществующие свойства игнорируются. Свойства ts у устройства быть не должно!!?
        const res = this.changeOne(prop, ts, inObj[prop]); // Возвращает всегда объект c изменениями иначе пустой объект
        if (res.val != undefined) {
          chobj[prop] = res.val;
          changed.push({ did: this._id, dn: this.dn, prop, value: res.val, ts });
        }

        errChanged = errChanged || res.err != undefined; // Изменилась ошибка свойства в ту или другую сторону
      }
    });

    // Обработка calc свойств   calc = [ { prop: 'state', when: '1', trigger: {value:1,setpont:1} } ]
    // if (this.typeobj.calc.length && (changed.length || errChanged)) {
    if (this.typeobj.calc.length) {
      this.typeobj.calc.forEach(calcItem => {
        if (needCalc(calcItem)) {
          const prop = calcItem.prop;
          const res = this.calcOne(prop, ts, calcItem.when ? inObj: chobj); // Значение для вычисляемых полей - передаем все изменения
          if (res.val != undefined) changed.push({ did: this._id, dn: this.dn, prop, value: res.val, ts });

          errChanged = errChanged || res.err != undefined;
        }
      });
    }

    // Обработка error - тоже может быть handler. Пока просто сумма ошибок
    if (errChanged) {
      let newerror = '';
      Object.keys(this._raw).forEach(prop => {
        const pobj = this._raw[prop];
        if (!newerror && pobj.err) newerror = prop + ': ' + pobj.err; // Ошибки свойств в основную ошибку передаются начисная с главного свойства
      });

      if (this.error != newerror) {
        this.error = newerror;
        changed.push({ did: this._id, dn: this.dn, prop: 'error', value: newerror, ts });
      }
    }
    return changed; // Если ничего не изменилось - пустой массив

    function needCalc(calcItem) {
      if (calcItem.when == 0) {
        // При изменении
        return (
          changed.length &&
          (!calcItem.trigger || hut.arrayIntersection(Object.keys(chobj), Object.keys(calcItem.trigger)))
        );
      }

      // При поступлении данных
      if (calcItem.when == 1) {
        return !calcItem.trigger || hut.arrayIntersection(Object.keys(inObj), Object.keys(calcItem.trigger));
      }
    }
  }

  /**  Обработка изменения одного свойства
   * Сохраняет в raw
   * При изменении обновляет значение this[prop]
   *
   * @param {String} prop
   * @param {Number} ts
   * @param {*} val
   *
   * @return {Object} - Возвращает объект {err, val} Если ничего не изменилось - пустой объект
   */
  changeOne(prop, ts, val) {
    this._raw[prop].raw = val; // Полученное значение сохраняем как raw, если не calc

    if (this.typeobj.props[prop].fn) {
      const newObj = this.tryRunHandler(prop, val);
      return this.setNewValueAndErr(prop, ts, newObj);
    }

    // Обработчика нет - значение присвоить напрямую
    return this.setNewValueAndErr(prop, ts, { newval: val });
  }

  tryRunHandler(prop, arg3, arg4) {
    // console.log('TRY '+prop+' arg3='+util.inspect(arg3)+' arg4='+util.inspect(arg4))
    let newerr = this._raw[prop].err;
    let newval = this._raw[prop].val;
    try {
      const res = this.typeobj.props[prop].fn(this, prop, arg3, arg4); // возвращает значение или объект
      // console.log('RES '+util.inspect(res))
      if (typeof res == 'object') {
        if (res.value != undefined) newval = res.value;
        if (res.error != undefined) newerr = res.error;
        if (res.timer) {
          // console.log('BEFORE  startTimer '+typeof this.agent.startTimer)
          this.agent.startTimer(res.timer, this._id, prop);
        }
      } else {
        newval = res;
        newerr = '';
      }
    } catch (e) {
      // Ошибка при выполнении обработчика
      newerr = 'Read handler error! ' + hut.getShortErrStr(e);
    }
    return { value: newval, err: newerr };
  }

  setNewValueAndErr(prop, ts, newObj) {
    const { value, err } = newObj;
    const changeres = {};
    if (this[prop] != value) {
      this._raw[prop].prev = this[prop];
      this._raw[prop].ts = ts;
      this._raw[prop].cts = ts;

      this._raw[prop].val = value;
      this[prop] = value; // НОВОЕ ЗНАЧЕНИЕ ЗАПИСАНО В УСТРОЙСТВО
      changeres.val = value;
    } else {
      this._raw[prop].ts = ts;
    }

    if (this._raw[prop].err != err) {
      this._raw[prop].err = err; // Ошибка свойства пишется только в _raw
      changeres.err = err;
    }
    return changeres;
  }

  /**  Calculate одного свойства
   *
   * При изменении обновляет значение this[prop]
   *
   *
   * @param {String} prop
   * @param {Number} ts
   * @param {*} chobj - изменения текущего шага
   *
   * @return {Object} - Возвращает объект {err, val} Если ничего не изменилось - пустой объект
   */
  calcOne(prop, ts, chobj, paramObj) {
    if (this.typeobj.props[prop].fn) {
      const newObj = this.tryRunHandler(prop, chobj, paramObj);
      return this.setNewValueAndErr(prop, ts, newObj);
    }
    // если функции нет - ничего не делаем
  }

  runCalcFun(prop, paramObj) {
    const changed = [];
    const ts = Date.now();
  
    const res = this.calcOne(prop, ts, null, paramObj);
    if (res.val != undefined) changed.push({ did: this._id, dn: this.dn, prop, value: res.val, ts });
    // TODO Здесь анализ ошибки и/или вызов сделующих calc по цепочке??

    // Функция вызвана извне (при сработке таймера) - нужно генерировать событие, если значение изм
    if (changed.length) this.agent.emitDeviceDataChanged(changed);
  }

  saveQts(prop, qts) {
    this._raw[prop].qts = qts; 
  }
}

// Частные функции модуля

module.exports = Devo;
