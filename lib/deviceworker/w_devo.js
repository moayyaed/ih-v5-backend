/**
 *  workdevo.js
 *
 *  Активный объект устройства
 *   - принимает данные свойств, отрабатывает обработчики
 *   - выполняет команды
 *   - отрабатывает таймеры
 *   - используется в сценариях (через обертку)
 *
 *   Объект устройства: {
 *    _id, dn, name, parent, type, <value, state, battery, auto, ...>, error}
 *          - объект содержит значения свойств
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
 *   _aux: {value:{min, max, dig,def, mu, save })
 *         - дополнительные атрибуты свойств
 *   _readSet: {}
 *   _writeSet: {}
 *    }
 */

const util = require('util');

const hut = require('../utils/hut');
// const deviceutil = require('./deviceutil');
const Basedevo = require('../device/basedevo');

class Devo extends Basedevo {
  /**
   * Конструктор устройства как объекта realtime
   * @param {Object} devStruct - анемичный объект, уже созданный из типа
   *
   * @param {Object} agent - объект для работы с таймерами, логами и отправки команд
   */

  constructor(devStruct, typeMap, agent) {
    super(devStruct, typeMap);
    this.agent = agent;

    // Сформировать команды по списку команд из типа
    this.typeobj.commands.forEach(command => {
      this[command] = this.doCommand.bind(this, command);
      this._raw[command] = { cmd: 1 };
    });
    this._alertslevel = {};
  }

  // если есть нерассчитанные fval - рассчитать
  // Возвращаются элементы без changed
  //  { did, dn: this.dn, prop, ts, value, fvalue };
  calcNullFval() {
    const res = [];
    Object.keys(this._raw).forEach(prop => {
      if (this.hasFormatHandler(prop) && this._raw[prop].fval == undefined && this._raw[prop].val != undefined) {
        const fvalue = this.runFormatHandler(prop);
        if (fvalue != undefined) {
          const { ts, val } = this._raw[prop];
          res.push({ did: this._id, dn: this.dn, prop, ts, value: val, fvalue });
        }
      }
    });
    return res.length ? res : '';
  }

  writeChannel(prop, val) {
    // console.log('WARN: ' + this.dn + ' writeChannel ' + prop);
    const item = { ...this.getWriteChannel(prop) };
    if (!this.isCommand(prop)) item.command = 'set';
    if (val != undefined) item.value = val;

    // console.log('WARN: ' + this.dn + ' writeChannel item= ' + util.inspect(item));
    this.agent.writeDeviceChannel(this._id, item);
  }

  doCommand(command, sender) {
    const now = Date.now();
    const logObj = { cmd: command, ts: now - 1, sender };
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

  setValue(prop, val, sender) {
    if (this.hasWriteChannel(prop)) {
      this.writeChannel(prop, val);
      // TODO - force??
      return;
    }
    // Изменение значения с запуском calculate других полей
    setImmediate(() => {
      const accepted = this.acceptData({ [prop]: val }, sender);
      this.agent.emitDeviceDataAccepted(accepted);
    });
  }

  setValues(propValObj, sender) {
    if (typeof propValObj != 'object') return;
    const toAccept = {};
    Object.keys(propValObj).forEach(prop => {
      const val = propValObj[prop];
      if (val != undefined) {
        if (this.hasWriteChannel(prop)) {
          this.writeChannel(prop, val);
        } else {
          toAccept[prop] = val;
        }
      }
    });
    if (hut.isObjIdle(toAccept)) return;

    // Изменение значения с запуском calculate других полей
    setImmediate(() => {
      const accepted = this.acceptData(toAccept, sender);
      this.agent.emitDeviceDataAccepted(accepted);
    });
  }

  /**
   * Присваивает значение любому свойству (даже calculate) ВИРТУАЛЬНО,  без записи в канал
   * Должно использоваться в сценариях и обработчиках
   * @param {*} prop
   * @param {*} val
   * @param {*} sender
   */
  assign(prop, val, sender) {
    // sender = { src: 'login:admin' }
    if (this._raw[prop] == undefined) return; // Несуществующие свойства игнорируются.

    // val может быть и объект {value, error}
    this.setRawErrorFields(prop, val); // Если val = { value, error} - установить ошибку
    const value = typeof val != 'object' ? val : val.value;
    const ts = Date.now();
    const accepted = [];
    if (value != undefined) {
      this._raw[prop].raw = value; // Полученное значение сохраняем как raw

      const one = this.acceptNewValue(prop, ts, value, sender);
      if (one) {
        if (this.hasFormatHandler(prop)) {
          one.fvalue = this.runFormatHandler(prop);
        }
        accepted.push(one);
      }
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

  hasCommand(command) {
    return typeof this[command] == 'function';
  }

  /*
  // Это все в basedevo
  getPropValue(inprop) {
    // м б value#string
    if (inprop.indexOf('#string') > 0) {
      const prop = inprop.substr(0, inprop.length - 7);
      return this.formatValue(prop, this[prop]);
    }

    return this[inprop];
  }

  hasFormat(prop) {
    return !!this.typeobj.props[prop].format;
  }


  // Вернуть сформатированное значение в виде строки
  formatValue(prop, val) {
    let result = this.applyPropType(prop, val);

    try {
      if (this.hasHandler('format_' + prop)) {
        const handlerObj = this.typeobj.getHandlerObjToRun('format_' + prop);

        const fn_format = handlerObj.fn;
        if (fn_format) {
          result = fn_format(this, prop, result);
        }
      }
    } catch (e) {
      // console.log('ERROR: fn_format for ' + this._id + ' prop=' + prop + util.inspect(e));
    }
    return result;
  }
  */

  getPropTitle(prop) {
    if (!prop) return '';
    if (this.typeobj.props[prop]) return super.getPropTitle(prop); // от типа - если свойство опр в типе - это осн название

    if (this.extProps[prop] && this.extProps[prop].scenes && this.extProps[prop].scenes[0]) {
      // от сценария - получить через agent
      return this.agent.getExtpropTitle(this.dn, prop, this.extProps[prop].scenes[0]);
    }

    return super.getPropTitle(prop); 
  }

  getPropTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].ts : 0;
  }

  getPropChangeTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].cts : 0;
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
    if (typeof inObj != 'object') return [];

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
    // let accobj; // Объекты {prop:value, ..}  для использования в calc обработчиках
    // let chobj; // формируются в needCalc
    /*
    const accobj = {};
    accepted.forEach(aitem => {
      accobj[aitem.prop] = aitem.value;
    });
    */

    const chobj = {};
    accepted.forEach(aitem => {
      if (aitem.changed) chobj[aitem.prop] = aitem.value;
    });
    if (this.typeobj.calc.length) {
      this.typeobj.calc.forEach(calcItem => {
        // if (needCalc(calcItem)) {
        // const one = this.calcOne(calcItem.prop, ts, calcItem.when ? accobj : chobj);
        const one = this.calcOne(calcItem.prop, ts, chobj);
        if (one) accepted.push(one);
        //  }
      });
    }

    // Обработка error - тоже может быть handler. Пока просто сумма ошибок свойств (OR )
    const one = this.updateError(ts);
    if (one) accepted.push(one);

    // if (accepted[0] && !accepted[0].did.startsWith('__UNIT')) {
    //  console.log('WARN: WORKER '+this._id+' accepted '+util.inspect(accepted));
    // }

    return accepted;
    /*
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
    */
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
    const newval = this.hasHandler(prop) ? this.runHandler(prop, val) : val;

    const accepted = this.acceptNewValue(prop, ts, newval, sender); // { did, dn, prop, ts, value: newval, changed: 1, prev };

    if (accepted && accepted.changed && this.hasFormatHandler(prop)) {
      accepted.fvalue = this.runFormatHandler(prop);
    }
    return accepted;

    // return this.acceptNewValue(prop, ts, newval, sender);
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
    const handlerObj = this.typeobj.getHandlerObj(prop);
    if (handlerObj.blk) return;

    let res;
    try {
      if (!handlerObj.sys) {
        res = this.agent.runUserHandler(this, handlerObj, prop, arg3, arg4);
      } else {
        res = handlerObj.fn(this, prop, arg3, arg4);
      }

      // Функция возвращает значение или объект
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
      // console.log('ERROR: ' + this.dn + ' ' + prop + ' handler error: ' + hut.getShortErrStr(e));
      this._raw[prop].err = 'Handler error: ' + hut.getShortErrStr(e);
      this._raw[prop].errts = Date.now();
    }
  }

  runFormatHandler(prop) {
    const handlerObj = this.typeobj.getHandlerObj('_format_' + prop);
    if (handlerObj.blk) return;

    const val = this[prop]; // Текущее принятое значение
    let res;
    if (!handlerObj.sys) {
      res = this.agent.runUserFormatHandler(this, handlerObj, prop, val);
    } else {
      res = handlerObj.fn(this, prop, val);
    }
    if (res != undefined) {
      this._raw[prop].fval = res;
      this[prop + '#string'] = res;
    }
    return res;
  }

  /**
   * Прием значения для свойства
   * @param {String} prop
   * @param {Ts} ts
   * @param {*} inval
   * @param {*} sender
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
    const err = this._raw[prop].err || ''; // Установил обработчик
    if (this[prop] == newval) return { did, dn: this.dn, prop, ts, value: newval, err };

    const prev = this[prop];
    this._raw[prop].prev = prev;
    this._raw[prop].cts = ts;
    this._raw[prop].val = newval;
    this[prop] = newval; // НОВОЕ ЗНАЧЕНИЕ ЗАПИСАНО В УСТРОЙСТВО
    return { did, dn: this.dn, prop, ts, value: newval, changed: 1, prev, err };
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
    if (this.hasHandler(prop)) {
      const newval = this.runHandler(prop, chobj);

      const accepted = this.acceptNewValue(prop, ts, newval);
      if (accepted && accepted.changed && this.hasFormatHandler(prop)) {
        accepted.fvalue = this.runFormatHandler(prop);
      }
      return accepted;
      // return res;
    }
    // если функции нет - ничего не делаем
  }

  // Если функция есть - проверить, что уже загружена
  hasHandler(prop) {
    const handlerObj = this.typeobj.getHandlerObj(prop);
    if (!handlerObj || handlerObj.blk) return;

    if (!handlerObj.fn) {
      // Пытаемся загрузить
      this.agent.getHandlerFunction(this.type, prop, handlerObj);
    }
    return !!handlerObj.fn;
  }

  hasFormatHandler(prop) {
    return this.hasHandler('_format_' + prop);
  }

  runCommandHandler(prop) {
    const handlerObj = this.typeobj.getHandlerObjToRun(prop);
    if (handlerObj.blk || !handlerObj.fn) return;

    if (!handlerObj.sys) {
      return this.agent.runUserHandler(this, handlerObj, prop);
    }

    // Встроеннв=ая (sys=1)
    const fn = handlerObj.fn;

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
    const logObj = { ts: Date.now(), txt }
    this.agent.logDevice(this._id, logObj);
    return logObj;
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

    this.agent.logMain(res);
  }
}

// Частные функции модуля

module.exports = Devo;
