/**
 * devo.js - объект устройства
 */
const util = require('util');

const hut = require('../utils/hut');
const jdb = require('../utils/jdb');
const cg = require('../utils/commongets');

exports.Device = Device;

const classes = new Set(['SensorD', 'SensorA', 'ActorD', 'ActorA', 'ActorE', 'Meter']);

// Изменяемые свойства устройства
const devprops = {
  ALL: {
    name: '',
    place: '',
    room: '',
    subs: '',
    txt: '',
    mu: '',

    db: false,
    dbmet: 0,
    dbforce: 0,
    dbtm: 0,
    dbcalc_type: '',
    dbwrite_need_on: 0,
    dbwrite_on: 0,

    fixval: 0,
    fixpar: 0,
    stmet: '0',
    stdelta: 0,
    timeout: 0,
    sharing: 0,
    historizing: 0,
    hidemob: 0,

    usesnippet: 0,
    snipperiod: '00:00:00',
    snipdeps:''
  },

  SensorD: {
    hasBlk: 1,
    dbline: false
  },

  SensorA: {
    decdig: 0,
    min: 0,
    max: 100,
    step: 1,
    dbdelta: 1,
    hasDefval: 0,
    skipoutr: 0,
    erroutr: 0,
    datatype: 0
  },

  Meter: {
    decdig: 0,
    twotariff: 0,
    dbdelta: 1,
    dbc: true,
    uptoHour: 0,
    uptoDay: 0,
    uptoMonth: 0
  },

  ActorD: {
    hasBlk: 0,
    hasAuto: 0,
    actconfirm: 0,
    disdsonoff: 0,
    dbline: false
  },

  ActorA: {
    decdig: 0,
    min: 0,
    max: 100,
    step: 1,

    dbline: false,
    dbdelta: 1,
    rgb: 0,
    hasBlk: 0,
    hasAuto: 0,
    hasDefval: 1,
    syncDefval: 1,
    actconfirm: 0,
    disdsonoff: 0,
    skipoutr: 0,
    erroutr: 0,
    datatype: 0
  },
  ActorE: {
    hasBlk: 0,
    hasAuto: 0,
    actconfirm: 0
  }
};

// Свойства-значения
const valprops = {
  SensorD: {
    dval: 0
  },
  SensorA: {
    aval: 0
  },
  Meter: {
    aval: 0
  },
  ActorD: {
    dval: 0
  },
  ActorA: {
    dval: 0,
    aval: 0
  },
  ActorE: {
    dval: 0
  }
};

// Опциональные свойства, связанные с другим свойством (флагом)
const relprops = {
  SensorD: [{ hasProp: 'hasBlk', relProp: 'blk', value: 0 }],
  SensorA: [{ hasProp: 'hasDefval', relProp: 'defval', value: 20 }],
  Meter: [{ hasProp: 'twotariff', relProp: 'aval2', value: 0 }],
  ActorD: [
    { hasProp: 'hasBlk', relProp: 'blk', value: 0 },
    { hasProp: 'hasAuto', relProp: 'auto', value: 1 },
    { hasProp: 'hasAuto', relProp: 'reauto', value: '' },
    { hasProp: 'hasAuto', relProp: 'reqts', value: 0 },
    { hasProp: 'hasAuto', relProp: 'retime_on', value: 300 },
    { hasProp: 'hasAuto', relProp: 'retime_off', value: 30 },
    { hasProp: 'hasAuto', relProp: 'runA', value: '' }
  ],
  ActorE: [{ hasProp: 'hasBlk', relProp: 'blk', value: 0 }, { hasProp: 'hasAuto', relProp: 'auto', value: 0 }],
  ActorA: [
    { hasProp: 'hasBlk', relProp: 'blk', value: 0 },
    { hasProp: 'hasAuto', relProp: 'auto', value: 1 },
    { hasProp: 'hasDefval', relProp: 'defval', value: 20 },
    { hasProp: 'rgb', relProp: 'rgbaval', value: [0, 0, 0, 0, 0] },
    { hasProp: 'rgb', relProp: 'rgbdefval', value: [255, 0, 0, 0, 0] }
  ]
};

//
const hardprops = {
  SensorD: [{ prop: 'dval', op: 'R' }],
  SensorA: [{ prop: 'aval', op: 'R' }],
  Meter: [{ prop: 'aval', op: 'R' }],
  ActorD: [{ prop: 'dval', op: 'R' }, { prop: 'on', op: 'W', value: 1 }, { prop: 'off', op: 'W', value: 0 }],
  ActorE: [{ prop: 'dval', op: 'R' }, { prop: 'set', op: 'W', value: 0 }],
  ActorA: [
    { prop: 'aval', op: 'R' },
    { prop: 'on', op: 'W', value: 1 },
    { prop: 'off', op: 'W', value: 0 },
    { prop: 'set', op: 'W', value: 0 }
  ]
};

// Свойства-значения, используемые при расстановке устройств
const valsForSetting = {
  SensorD: { stval: 0, wmode: 'blk', err: 'error' },
  SensorA: { stval: 0, wmode: 'empty', aval: 20, defval: 20, err: 'error' },
  Meter: { stval: 0, wmode: 'empty', aval: 1111, aval2: 2222, err: 'error' },
  ActorD: { stval: 0, wmode: 'auto', err: 'error' },
  ActorE: { stval: 0, wmode: 'empty', err: 'error' },
  ActorA: { stval: 0, wmode: 'auto', aval: 20, defval: 100, err: 'error' }
};

const publicPropArray = [
  { prop: 'auto', note: 'AUTOMODE' },
  { prop: 'blk', note: 'BLK' },
  { prop: 'err', note: 'ERROR' }
];

/**  Конструктор
 *    @param {object} devref - свойства устройства из файла devref
 *    Значения пока не определены - присваиваем дефолтные
 **/
function Device(devref, devlogger) {
  this.devlogger = devlogger;

  // Неизменяемые свойства
  this.id = devref.dn;
  this.dn = devref.dn;
  this.cl = devref.cl;
  this.sys = devref.sys || 0;

  this.type = devref.type;

  Device.setMainProps(devref, this);

  Object.keys(valprops[this.cl]).forEach(prop => {
    this[prop] = valprops[this.cl][prop];
  });

  this.setRelProps();

  if (this.usesnippet) this.unit = 'snippet';

  // TODO - эти функции вытаскивают из вспомогательных таблиц devhard и devstates. При больших объемах дают тормоза на старте
  // Нужно на старте делать для всех устройств сразу
  // this.setHardLink();
  this.setHardLinkFromIdx(); // Это новая функция - извлекает по dn, а не фильтром

  this.setStates(); // состояния и qst - по старому т к там несколько записей

  // Состояние, ошибка и флаг ожидания
  this.stval = 0;
  this.prevstval = 0;
  this.err = 0;
  this.wait = 0;
  this.lastts = 0;
  this.changets = 0;
  this.log = [];
}

Device.prototype.setHardLinkFromIdx = function() {
  let devhardItem = jdb.getRecordByIdxkey('devhard', 'dn', this.dn);
  // Д б не более одной записи
  if (!devhardItem) return;

  // TODO - проверить, что ровно одна запись!!!!!
  this.unit = devhardItem.unit;
  this.channel = devhardItem.complex ? 'complex' : devhardItem.chan;
};

// Статическая функция устанавливает основные свойства. Используется также, когда устройства еще нет (при добавлении)
Device.setMainProps = function(devref, theDevice) {
  // Общие свойства - заполнить по списку devprops.ALL, брать значение по умолчанию, если нет в devref
  Object.keys(devprops.ALL).forEach(prop => {
    theDevice[prop] = devref[prop] != undefined ? devref[prop] : devprops.ALL[prop];
  });

  // Свойства в зависимости от класса
  Object.keys(devprops[theDevice.cl]).forEach(prop => {
    theDevice[prop] = devref[prop] != undefined ? devref[prop] : devprops[theDevice.cl][prop];
  });
};

// Статическая функция проверяет, что класс существует
Device.isClass = function(cl) {
  return classes.has(cl);
};

// Статическая функция возвращает
Device.getClassHardProps = function(cl) {
  return hardprops[cl];
};

Device.mapPropToV4 = function(prop) {
  switch (prop) {
    case 'dval':
      return 'state';

    case 'aval':
      return 'value';

    case 'stval':
      return 'state';

    case 'defval':
      return 'setpoint';

    case 'err':
      return 'error';
    default:
      return prop;
  }
};

// Установить или удалить свойства, которые определяются другими свойствами
Device.prototype.setRelProps = function() {
  relprops[this.cl].forEach(item => {
    if (this[item.hasProp]) {
      if (this[item.relProp] == undefined || typeof this[item.relProp] != typeof item.value) {
        this[item.relProp] = item.value;
      }
    } else {
      delete this[item.relProp];
    }
  });
};

// Изменение свойств при редактировании
Device.prototype.update = function(item) {
  if (typeof item == 'object') {
    // Изменение типа?
    if (item.type) this.type = item.type;

    // Общие свойства
    Object.keys(item).forEach(prop => {
      if (devprops.ALL[prop] != undefined) this[prop] = item[prop];
    });

    // Свойства класса
    Object.keys(item).forEach(prop => {
      if (devprops[this.cl][prop] != undefined) this[prop] = item[prop];
    });
    this.setRelProps();
  }
};

Device.prototype.getValsForSetting = function() {
  // return valsForSetting[this.cl];

  let valobj = hut.clone(valsForSetting[this.cl]);
  Object.keys(valobj).forEach(prop => {
    if (prop == 'aval' || prop == 'defval') {
      // Отформатировать, добавить ед изм
      valobj[prop] = Number(valobj[prop]).toFixed(this.getDecdig()) + this.mu;
    }
  });
  return valobj;
};

Device.prototype.getDecdig = function() {
  if (this.decdig > 6) this.decdig = 6;
  return this.decdig > 0 ? this.decdig : 0;
};

/**
 * Возвращает объект - значения базовых динамических свойств устройства для показа на интерфейсе
 * stval, <aval, defval>, wmode, err
 */
Device.prototype.getValsRealtime = function() {
  let robj = { stval: this.stval, err: this.err, wmode: this.getWmode() };

  if (this.err != undefined) {
    robj.err = this.err ? 'error' : 'empty';
  }

  // Для аналогового значения - выводим единицу измерения, если она есть, без пробела!
  // Также выполнить форматирование при выводе - число цифр после запятой
  if (this.isAnalog()) {
    robj.aval = this.getAnalogValueForView('aval');
    if (this.hasDefval) {
      robj.defval = this.getAnalogValueForView('defval');
    }
  }
  if (this.twotariff) robj.aval2 = this.getAnalogValueForView('aval2');
  return robj;
};

Device.prototype.getAnalogValueForView = function(prop) {
  if (this.type == 530 && prop == 'aval') {
    return this[prop] && Array.isArray(this[prop]) ? this[prop].join(',') : '0,0,0';
  }

  let val = isNaN(this[prop]) ? this[prop] : Number(this[prop]).toFixed(this.getDecdig());
  return val + this.mu;
};

Device.prototype.getWmode = function() {
  // Блокировка - самый высокий приоритет
  if (this.hasBlk && this.blk) return 'blk';

  let wmode = 'empty';
  if (this.hasAuto) {
    if (this.reauto) {
      wmode = 'reauto';
    } else if (this.auto) {
      wmode = 'auto';
    }
  }
  return wmode;
};

/**
 * Устанавливает измененные значения свойств устройства, полученные от плагина
 *     @param {object} pobj - свойства устройства с новыми значениями
 *
 * Возвращает объект - только реально измененные свойства
 * Если изменений нет - возвращается не объект (undefined)
 */
Device.prototype.setPropsFromUnit = function(pobj) {
  if (!pobj) return;

  // добавить время поступления данных с устройства: его может передать устройство или берем текущее
  // Время lastts меняется, даже если значение не изменилось!

  // ЕСЛИ ЭТО ОШИБКА timeout
  if (pobj.errtm) {
    this.errtm = 1;
    pobj.err = 'Device timeout error!';
  } else {
    this.lastts = pobj.ts || Date.now();
    this.errtm = 0;
  }

  let result;
  if (!pobj.err) pobj.err = 0;

  if (pobj.err) {
    // Если ошибка - возвращаем только ошибку
    if (this.changeErrorProp(pobj.err)) {
      result = { err: this.err };
      this.addLog({ err: this.err });
    }
  } else {
    result = this.setProps(pobj);

    // Установка или сброс ошибки - setProps возвращает ошибку вне диапазона
    if (this.changeErrorProp(pobj.err)) {
      result = Object.assign({ err: pobj.err }, result);
    }

    // Если последнее значение в логе все еще ошибка - записать в лог
    if (!this.err && this.log.length > 0 && this.log[this.log.length - 1].err) {
      this.addLog();
    }
  }

  if (result) {
    this.changets = this.lastts;
  }
  return result;
};

Device.prototype.isDeviceInTimeout = function() {
  return this.timeout > 0 && (!this.lastts || Date.now() - this.lastts > this.timeout * 1000);
};

Device.prototype.addLog = function(rec, sender) {
  if (!rec) rec = {};

  if (this.log.length > 100) this.log.shift();
  if (!rec.ts) rec.ts = Date.now();

  if (rec.act) {
    // Фиксируем команду и кто ее послал
    Object.assign(rec, sender);
  } else if (!rec.err && rec.val == undefined) {
    rec.val = this.getMainVal();
  }

  this.log.push(rec);
  if (this.devlogger) {
    this.devlogger.log(Object.assign({ dn: this.dn }, rec));
  }
};

Device.prototype.getMainVal = function() {
  if (this.aval != undefined) return this.aval;
  if (this.dval != undefined) return this.dval;
};

Device.prototype.changeErrorProp = function(newerr) {
  // Установка или сброс ошибки
  if (this.err != newerr) {
    this.err = newerr;
    return true;
  }
};

/**
 * Устанавливает измененные значения свойств устройства
 *     @param {object} pobj - свойства устройства с новыми значениями
 * Значение будет присвоено только если у устройства есть такое свойство
 * Но при первоначальной загрузке загружаем все подряд (first - из devcurrent)
 *
 * Возвращает объект - только реально измененные свойства
 * Если изменений нет - возвращается не объект (undefined)
 */
Device.prototype.setProps = function(pobj, first) {
  let robj = {};

  Object.keys(pobj).forEach(prop => {
    if (first || typeof this[prop] != undefined) {
      if (typeof pobj[prop] === 'object') {
        if (!hut.deepEqual(this[prop], pobj[prop])) {
          robj[prop] = this[prop] = hut.clone(pobj[prop]);
        }
      } else if (this.isMainProp(prop)) {
        pobj[prop] = isNaN(pobj[prop]) ? pobj[prop] : Number(pobj[prop]);
        let val;
        // Для дискретных устройств - д. б. число не более кол-ва состояний
        if (this.cl == 'SensorD' || this.cl == 'ActorD') {
          val = pobj[prop];
          if (isNaN(val)) {
            this.addLog({ val, err: 1, skip: 1 });
          } else if (this[prop] != val) {
            robj[prop] = this[prop] = Number(val);
            this.addLog({ val });
          }
        } else {
          // Для главного свойства - проверить выход за пределы диапазона

          let outOfRange = this.isOutOfRange(prop, Number(pobj[prop]));
          if (outOfRange && this.erroutr) pobj.err = 1;

          val = this.valToFixed(pobj[prop]);
          if (outOfRange && this.skipoutr) {
            // Будет пропущено.TODO  Логировать, если последнее значение изменилось!!
            this.addLog({ val, err: 1, skip: 1 });
          } else {
            // Присвоить значение, которое пришло. А проверять округленное
            if (val != this.valToFixed(this[prop])) {
              robj[prop] = val;
              this.addLog({ val, err: pobj.err });

              // Новое значение aval - сохранить в defval, если syncDefval
              if (this.isActor() && this.hasDefval && this.syncDefval && val > 0) {
                this.defval = val;
                robj.defval = val;
              }
            }
            // Присвоить в любом случае полученное значение без округления. Это важно в случае счетчиков - накапливать суммируемые импульсы

            this[prop] = pobj[prop];
          }
        }
      } else {
        // Простое не основное свойство
        if (!isNaN(pobj[prop]) && prop == 'defval') {
          pobj[prop] = Number(Number(pobj[prop]).toFixed(this.getDecdig()));
        }

        if (this[prop] != pobj[prop]) {
          robj[prop] = this[prop] = pobj[prop];
        }
      }
    }
  });

  if (!hut.isObjIdle(robj)) {
    this.checkInterconnectedProps(robj, first);
    return robj;
  }
};

Device.prototype.valToFixed = function(val) {
  try {
    return isNaN(val) ? val : Number(val).toFixed(this.getDecdig());
  } catch (e) {
    console.log('valToFixed ERROR: ' + this.dn + '=' + val + ' dig=' + this.decdig);
    return val;
  }
};

Device.prototype.isMainProp = function(prop) {
  return prop == this.getMainProp();
};

Device.prototype.getMainProp = function() {
  let prop;
  switch (this.cl) {
    case 'SensorA':
    case 'ActorA':
      prop = 'aval';
      break;
    default:
      prop = 'dval';
  }
  return prop;
};

Device.prototype.getRealPropName = function(prop) {
  if (!prop || prop == 'value') return this.getMainProp();
  if (prop == 'setpoint') return 'defval';
  if (prop == 'state') return 'stval';
  if (prop == 'error') return 'err';
  return prop;
};

Device.prototype.getActLogStr = function(act, prop, value) {
  let lprop = prop;
  switch (prop) {
    case 'dval':
    case 'aval':
    case 'value':
      lprop = '';
      break;
    case 'defval':
      lprop = 'setpoint';
      break;

    default:
  }
  return (act || '') + ' ' + lprop + ' ' + (value || '');
};

Device.prototype.isOutOfRange = function(prop, val) {
  if (prop != 'aval' || isNaN(val)) return;

  if (this.min != undefined && this.max != undefined) {
    if (this.skipoutr || this.erroutr) {
      // Проверить вхождение в диапазон
      return this.min > val || this.max < val;
    }
  }
};

/**
 * Если изменились свойства, которые влияют на другие - изменить
 *
 * При изменении aval для актуатора (или сенсора с мультипорогами) нужно пересчитать dval
 * В простейшем случае - если aval=0/>0 - установить dval 0/1
 *
 * TODO В других случаях - это может зависеть от порогов
 * Здесь пока реализована пропорциональная установка номера состояния
 */
Device.prototype.checkInterconnectedProps = function(robj, first) {
  if (this.cl == 'ActorA') {
    let newdval;
    // newdval = this.rgb ? getDvalForRgbAval(this.aval) : getDvalForAval(this.aval, this.qst);
    // newdval = this.rgb ? getDvalForRgbAval(this.aval) : getDvalForAval(this.aval, this.qst);
    if (this.isRGB()) {
      newdval = getDvalForRgbAval(this.aval);
    } else {
      newdval = this.aval > 0 ? 1 : 0;
    }
    if (this.dval !== newdval) {
      robj.dval = this.dval = newdval;
    }
  }

  if (first) {
    // восстановить reauto или установить auto если время прошло
    if (robj.reauto) {
      if (robj.reqts > 0 && hut.getSecInterval(Date.now(), robj.reqts) > 0) {
        this.reauto = robj.reauto;
        this.reqts = robj.reqts;
      } else {
        this.reauto = 0;
        this.reqts = 0;
        this.auto = 1;
      }
    }
  } else if (robj.dval != undefined) {
    // Если изменился dval - нужно проверить насчет reauto
    let act = robj.dval > 0 ? 'on' : 'off';

    if (this.needReauto(act) && act != this.runA) {
      robj.auto = this.auto = 0;
      robj.reauto = this.reauto = act;
      // Записать в журнал устройства
      this.addLog({ act: 'prop:auto', act_val: 0 }, {});
    }
    if (this.runA) this.runA = '';
  }

  if (this.auto) this.reauto = '';

  if (this.setStval()) {
    robj.stval = this.stval;
  }
};

Device.prototype.isActor = function() {
  return this.cl == 'ActorD' || this.cl == 'ActorA' || this.cl == 'ActorE';
};

Device.prototype.isRGB = function() {
  return this.cl == 'ActorA' && (this.type == 530 || this.type == 534 || this.type == 535);
};

Device.prototype.isAnalog = function() {
  return this.cl == 'SensorA' || this.cl == 'ActorA' || this.cl == 'Meter';
};

Device.prototype.getRGBValueForCommand = function(act, value) {
  // if (act == 'off') return this.type == 534 ? [0, 0, 0, 0] : [0, 0, 0];
  if (act == 'off') return [0, 0, 0, 0, 0];

  if (act == 'on') {
    if (this.defval && Array.isArray(this.defval)) {
      if (this.defval.length < 5) {
        this.defval.length = 5;
        this.defval.forEach(item => {
          if (item == undefined) item = 0;
        });
      }

      return this.defval;
    }

    // return this.type == 534 ? [255, 0, 0, 100] : [255, 0, 0];
    return [255, 0, 0, 100, 0];
  }
  return value;
};

// ЗДЕСЬ надо проверить основные и дополнительные команды!!
Device.prototype.hasAct = function(act) {
  if (this.isActor()) {
    return act == 'on' || act == 'off' || act == 'toggle' || act == 'set' || act == 'set+' || act == 'set-';
  } else if (this.cl == 'Meter') {
    return act == 'set';
  }
};

/**
 *  Выполнить команду виртуально
 *    Вернуть объект изменений
 */
// toggle - делается на предыдущем уровне? - преобразуется в on или off
// TODO - неполный функционал для set -
Device.prototype.execute = function(act, val) {
  switch (act) {
    case 'on':
      return this.isAnalog()
        ? this.setProps({ aval: this.defval ? this.defval : this.max / 2 })
        : this.setProps({ dval: 1 });

    case 'off':
      return this.isAnalog() ? this.setProps({ aval: 0 }) : this.setProps({ dval: 0 });
    // return this.setProps({ dval: 0 });

    case 'set':
      if (this.cl == 'ActorE') return this.setProps({ dval: val });
      if (this.cl == 'ActorA') return this.setProps({ aval: val });
      if (this.cl == 'Meter') return this.setProps({ aval: val });
      break;

    default:
    // дополнительные команды?
  }
};

/**
 * Установить stval - состояние для индикации
 * при изменении текущего значения возвращает true;
 */
Device.prototype.setStval = function() {
  let oldstval = this.stval;

  switch (this.stmet) {
    // Интервалы
    case '1':
      this.calcStateFromInterval();
      break;

    default:
      this.stval = this.cl == 'SensorA' || this.cl == 'Meter' ? 0 : this.dval;
  }
  /*
  switch (this.stmet) {
    // Пропорционально аналоговому значению
    case '1':
      if (!this.qst) {
        this.stval = 0;
      } else {
        this.calcStatePropAval();
      }
      break;

    // По порогу devref - здесь нужна погрешность округления?
    case '2':
      this.calcStateFromDefval();
      break;

    // Интервалы
    case '3': break;

     // Функция вычисления выражения
    case '4':
      if (this.funst && typeof this.funst === 'function') {
        this.stval = this.funst();
      }
      break;

     // НЕ нужно - внешний сценарий сам будет устанавливать stval
    case '5': break;

    //
    default: this.stval = this.dval;
  }
  */

  // return this.stval != oldstval;
  if (this.stval != oldstval) {
    this.prevstval = oldstval;
    return true;
  }
};

Device.prototype.calcStateFromInterval = function() {
  if (!this.states || this.states.length <= 1) {
    this.stval = 0;
    return;
  }

  for (let i = 0; i < this.states.length; i++) {
    if (this.states[i].upbound != undefined && this.states[i].upbound != '') {
      if (Number(this.aval) <= Number(this.states[i].upbound)) {
        this.stval = i;
        return;
      }
    }
  }
  // Иначе возвращается последнее
  this.stval = this.states.length - 1;
};

Device.prototype.calcStatePropAval = function() {
  let d = (this.max - this.min) / (this.qst - 1);
  if (this.isActor()) {
    this.stval = this.dval && d ? Math.round(this.aval / d) + 1 : 0;
  } else {
    // значение получено?
    this.stval = d ? Math.round(this.aval / d) + 1 : 0;
  }
  if (this.stval > this.qst) this.stval = this.qst;
};

Device.prototype.calcStateFromDefval = function() {
  if (this.hasDefval) {
    if (this.aval < this.defval) {
      this.stval = 1;
    } else if (this.aval > this.defval) {
      this.stval = 3;
    } else {
      this.stval = 2;
    }
  } else {
    this.stval = 0;
  }
};
/*
function getDvalForAval(aval, qstates) {
  let dval;
  if (qstates > 2) {
    dval = aval > 0 ? Math.round(aval / qstates) + 1 : 0;
  } else {
    dval = aval > 0 ? 1 : 0;
  }
  return dval;
}
*/

function getDvalForRgbAval(aval) {
  let dval = 0;

  if (aval && util.isArray(aval)) {
    dval = aval.some(item => item > 0) ? 1 : 0;
  }
  return dval;
}

Device.prototype.nameOf = function(prop) {
  return jdb.getRelVal('devref', prop, this[prop]) || '';
};

Device.prototype.nameOfState = function(state) {
  let states = this.getStates();
  return states && states[state] ? states[state].name : '';
};

Device.prototype.wtxtOfState = function(state) {
  return this.states && this.states[state] && this.states[state].wtxt && this.states[state].wtxt.txt
    ? this.states[state].wtxt.txt
    : '';
};

Device.prototype.getPlaceDesc = function() {
  let place_name = this.nameOf('place') || '';
  let room_name = this.nameOf('room') || '';

  let str = `${place_name}${place_name && room_name ? '/ ' : ''}${room_name}`;
  return str;
};

Device.prototype.addExtProp = function({ prop, op, val }) {
  if (!this.ext) this.ext = {}; // список ext свойств - нужен для сохранения значений ext в devcurrent
  this.ext[prop] = op;

  // Присвоить только если нет такого свойства
  if (this[prop] == undefined) {
    this[prop] = val != undefined ? val : '';
  }
};

/**
 * Добавить новые ext свойства устройству от сценария или плагина
 *
 * @param {*} extProps - массив добавляемых свойств: [{name:'power', note:'Мощность', type:'number', val:0, op:'r/w/rw'}]
 * @param {Object} sobj - объект, определяющий источник - {unit:'wip1'} или {scene:'testscene', sceneid:'7'}
 *
 * Свойства добавить устройству, присвоить значение val (default), если undefined
 *
 * Информацию о каждом свойстве из массива extProps и sobj записать в вирт таблицу devextprops
 */
/*
Device.prototype.addExtProps = function(extProps, sobj) {
  if (!extProps || typeof extProps != 'object' || hut.isObjIdle(extProps)) return;
  if (!sobj || typeof sobj != 'object' || hut.isObjIdle(sobj)) return;

  if (!util.isArray(extProps)) extProps = [extProps];
  if (!this.ext) this.ext = {}; // список ext свойств - нужен для сохранения значений ext в devcurrent

  extProps.forEach(item => {
    if (item.name) {
      if (this[item.name] == undefined) {
        // Новое свойство - добавляем dobj.prop
        this[item.name] = item.val != undefined ? item.val : '';
        this.ext[item.name] = 1;
      }

      // Добавляем описание в devextprops
      let filter = Object.assign({ dn: this.dn, prop: item.name }, sobj);
      let rec = jdb.get({ name: 'devextprops', filter });
      let payload;
      let opt = {};
      if (!rec.length) {
        payload = [Object.assign({ _status: { op: 'add' } }, filter, item)];
      } else {
        // Нужно заменить
        payload = [Object.assign({ id: rec[0].id, _status: { op: 'update' } }, filter, item)];
        opt.replace = 1;
      }
      jdb.update({ name: 'devextprops', payload, opt });
    }
  });
};
*/

/**
 * Удалить одно ext свойство устройства
 *
 * @param {string} prop
 * Проверяем, есть рабочие записи в devextprops (заполнено unit или scene)
 * Если нет - удалить св-во
 */
Device.prototype.deleteExtProp = function(prop) {
  let theProps = jdb
    .get({ name: 'devextprops', filter: { dn: this.dn, prop } })
    .filter(item => item.unit || item.scene);

  if (!theProps || theProps.length <= 0) {
    if (this.ext && this.ext[prop]) delete this.ext[prop];
    delete this[prop];
  }
};

Device.prototype.getDefaultHardProps = function() {
  let res = hardprops[this.cl];

  return res.map(item => Object.assign(item, { dn: this.dn }));
};

Device.prototype.isPropUnitLinked = function(prop) {
  if (this.unit) {
    return hardprops[this.cl].filter(item => item.prop == prop && item.op == 'W').length > 0;
  }
};

Device.prototype.setHardLink = function() {
  let devhard = jdb.get({ name: 'devhard', filter: { dn: this.dn } });
  // Д б не более одной записи
  if (!devhard || devhard.length <= 0) return;

  // TODO - проверить, что ровно одна запись!!!!!
  this.unit = devhard[0].unit;
  this.channel = devhard[0].complex ? 'complex' : devhard[0].chan;
};

// Полностью очищается и создается заново
// Это массив
Device.prototype.setStates = function() {
  let states = jdb.get({ name: 'devstates', filter: { dn: this.dn } });
  this.states = states && util.isArray(states) && states.length > 0 ? states : '';
  this.qst = this.getStates().length;
};

Device.prototype.getStates = function() {
  return this.states ? this.states : getStatesByType(this.type);
};

Device.prototype.getImageArray = function() {
  return this.getStates().map(item => ({ img: item.img, imgColor: item.imgColor }));
};
// Удалить при удалении состояния
Device.prototype.deleteState = function(statenum) {
  for (let i = this.states.length - 1; i >= 0; i--) {
    if (this.states[i].state == statenum) this.states.splice(i, 1);
  }

  this.qst = this.getStates().length;
};

// Возвращает свойства объекта статические, которые используются в сценариях (и плагинах)
Device.prototype.getDeviceV4 = function() {
  return {
    id: this.dn,
    cl: this.cl,
    type: this.type,
    dn: this.dn,
    name: this.name,
    place: this.place,
    zone: this.room,
    subs: this.subs,
    placeName: this.nameOf('place'),
    zoneName: this.nameOf('room'),
    subsName: this.nameOf('subs'),
    fullName: this.name + '. ' + this.getPlaceDesc(),
    mu: this.mu,
    sharing: this.sharing,
    historizing: this.historizing
  };
};

// Возвращает текущие динамические свойства объекта + dn
Device.prototype.getCurrent = function(v4) {
  let robj = { id: this.dn };
  if (!v4) {
    if (this.dval != undefined) robj.dval = this.dval;
    if (this.aval != undefined) robj.aval = this.aval;
    if (this.defval != undefined) robj.defval = this.defval;
  } else {
    robj.value = this.getMainVal();
    if (this.stval != undefined) robj.state = this.stval;
    if (this.defval != undefined) robj.setpoint = this.defval;
    if (this.err != undefined) robj.error = this.err;
  }

  if (this.lastts != undefined) robj.lastts = this.lastts;
  if (this.blk != undefined) robj.blk = this.blk;
  if (this.auto != undefined) robj.auto = this.auto;
  if (this.retime_on != undefined) robj.retime_on = this.retime_on;
  if (this.retime_off != undefined) robj.retime_off = this.retime_off;
  if (this.reauto != undefined) robj.reauto = this.reauto;
  if (this.reqts != undefined) robj.reqts = this.reqts;

  if (this.ext != undefined && typeof this.ext == 'object') {
    Object.keys(this.ext).forEach(extprop => {
      if (this[extprop] != undefined) robj[extprop] = this[extprop];
    });
  }
  return robj;
};

Device.prototype.getCurrentPropValues = function(props) {
  let robj = { id: this.dn };
  let propArr;
  if (typeof props == 'string') {
    propArr = props.split(',');
  } else if (util.isArray(props)) {
    propArr = props;
  } else propArr = [];

  propArr.forEach(prop => {
    let val = this.getPropValueV4(prop);
    if (val != undefined) robj[prop] = val;
  });
  return robj;
};

Device.prototype.getPropValueV4 = function(prop) {
  switch (prop) {
    case 'value':
      return this.getMainVal();

    case 'state':
      return this.getState();

    case 'setpoint':
      return this.getSetpoint();
    case 'error':
      return this.err;
    default:
      return this[prop];
  }
};

Device.prototype.getSetpoint = function() {
  if (this.hasDefval) return this.defval;
};

Device.prototype.getState = function() {
  return this.stval == undefined ? 0 : this.stval;
};

Device.prototype.needReauto = function(act) {
  return (
    this.hasAuto &&
    ((act == 'on' && this.retime_on > 0) || (act == 'off' && this.retime_off > 0)) &&
    (this.auto || (this.reauto && this.reauto != act))
  );
};

Device.prototype.getUnitIndicator = function() {
  if (this.dval > 0) {
    return this.err ? 3 : this.dval;
  }
  return 0;
};

Device.prototype.getPublicProps = function() {
  let res = publicPropArray
    .filter(item => this[item.prop] != undefined)
    .map(item => ({ id: item.prop, name: cg.getMessage(item.note) }));

  if (this.hasDefval) {
    res.unshift({ id: 'setpoint', name: cg.getMessage('SETPOINT') });
  }

  if (this.isAnalog()) {
    res.unshift({ id: 'state', name: cg.getMessage('STATE') });
  }
  res.unshift({ id: 'value', name: cg.getMessage('VALUE') });

  if (this.dval != undefined) {
    res.unshift({ id: 'OFF', name: 'OFF' });
    res.unshift({ id: 'ON', name: 'ON' });
  }

  const extprops = jdb.get({ name: 'devextprops', filter: { dn: this.dn } });

  if (extprops && extprops.length > 0) {
    extprops.forEach(item => {
      res.push({ id: item.prop, name: item.note });
    });
  }
  return res;
};

Device.prototype.directlyWriteDbFromUnit = function() {
  // return this.db && (this.dbmet == 1 || (this.dbmet == 3 && this.dbwrite_on));
  return this.db && this.dbmet == 1 && (!this.dbwrite_need_on || this.dbwrite_on);
};

Device.prototype.dbwrite_item = function(ts) {
  return { dn: this.dn, val: this.getMainVal(), ts: ts || Date.now() };
};

//  Частные функции
//  возвращает массив состояний по типу
function getStatesByType(type) {
  let states = [];
  if (type) {
    let typeobj = jdb.get({ name: 'types', filter: { id: type } });
    if (typeobj) states = typeobj[0].states.map(item => Object.assign(item, { state: item.id }));
  }
  return states;
}
