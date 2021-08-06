/**
 *  basedevo.js
 *
 *   Объект устройства: {
 *    _id, dn, name, parent, type, <value, state, battery, auto, ...>, error}
 *          - объект содержит значения статических и динамических свойств
 *   _raw: {value:{raw, val, fval, ts, cts, src, err}
 *
 *   _aux: {value:{min, max, dig,def, mu, save })
 *         - дополнительные атрибуты свойств-значений (не команды)
 *   _readSet: {}
 *   _writeSet: {}
 *    }
 */

const util = require('util');

const hut = require('../utils/hut');
const deviceutil = require('./deviceutil');

class Basedevo {
  /**
   * Конструктор устройства
   * @param {Object} devStruct - анемичный объект, уже созданный из типа
   * @param {Object} typeMap - объект с типами
   *
   */

  constructor(devStruct, typeMap) {
    Object.assign(this, devStruct);
    this.typeMap = typeMap;
  }

  get typeobj() {
    // Вся информация о структуре, типе данных, ф-и - обработчики - здесь
    return this.typeMap.get(this.type);
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
    deviceutil.setChannel(this, prop, chanObj);
  }

  clearChannel(prop) {
    deviceutil.clearChannel(this, prop);
  }

  hasProp(prop) {
    return !!this._aux[prop];
  }

  isWritable(prop) {
    const op = this.getOp(prop);
    return op == 'rw' || op == 'par';
  }

  getOp(prop) {
    return this.typeobj.props[prop] ? this.typeobj.props[prop].op : this.extProps[prop] ? 'par' : '';
  }

  isParam(prop) {
    return this.getOp(prop) == 'par' ? 1 : 0;
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
    deviceutil.addProp(this, prop, typePropItem, devPropItem);
  }

  /**
   * Удаляет свойство
   * @param {String} prop - имя свойства
   */
  deleteProp(prop) {
    delete this._aux[prop];
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
        /*
        if (p.op == 'cmd') {
          this[prop] = this.doCommand.bind(this, prop);
        } else {
        */
        if (p.op != 'cmd') {
          const typePropItem = this.typeobj.proparr.find(item => item.prop == prop);
          this.addProp(prop, typePropItem);
        }
      });
    }
  }

  getPropValue(inprop) {
    // м б value#string
    /*
    if (inprop.indexOf('#string') > 0) {
      const prop = inprop.substr(0, inprop.length - 7);
      return this.formatValue(prop, this[prop]);
    }
    */
    return this[inprop];
  }

  hasFormat(prop) {
    return !!this.typeobj.props[prop].format;
  }

  // Вернуть сформатированное значение в виде строки
  formatValue(prop, val) {
    let result = this.applyPropType(prop, val);
    try {
      const handlerObj = this.typeobj.getHandlerObjToRun('format_' + prop);

      const fn_format = handlerObj.fn;
      if (fn_format) {
        result = fn_format(this, prop, result);
      }
    } catch (e) {
      console.log('ERROR: fn_format for ' + this._id + ' prop=' + prop + util.inspect(e));
    }
    return result;
  }

  getPropTitle(prop) {
    if (!prop) return '';
    let addStr = '';
    if (prop.indexOf('#string')>0) {
      prop = prop.split('#')[0];
      addStr = ' в виде строки';
    }

    if (this.typeobj.props[prop]) return (this.typeobj.props[prop].name || prop)+addStr; // от типа

    if (this.extProps[prop]) {
      if (this.extProps[prop].scenes && this.extProps[prop].scenes[0]) {
        return prop;
        // TODO - от сценария - получить через agent
        // return this.agent.getExtpropTitle(this.dn, prop, this.extProps[prop].scenes[0]);
      }
      if (this.extProps[prop].note) return this.extProps[prop].note;
    }

    return prop+addStr;
  }

  getMin(prop) {
    return this._aux[prop] ? hut.getNumberOrNull(this._aux[prop].min) : null;
  }

  getMax(prop) {
    return this._aux[prop] ? hut.getNumberOrNull(this._aux[prop].max) : null;
  }

  getDefault(prop) {
    return this._aux[prop] ? this._aux[prop].def : null;
  }

  getDig(prop) {
    return this._aux[prop] ? this._aux[prop].dig : 0;
  }

  getMu(prop) {
    return this._aux[prop] && this._aux[prop].mu ? this._aux[prop].mu : '';
  }

  getSave(prop) {
    return this._aux[prop] ? this._aux[prop].save : 0;
  }

  getRounded(prop, value) {
    if (value == undefined || isNaN(value)) return;
    value = parseFloat(value);
    return Number(value.toFixed(this.getDig(prop)));
  }

  getPropTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].ts : 0;
  }

  getPropChangeTs(prop) {
    return prop && this._raw[prop] ? this._raw[prop].cts : 0;
  }

  // Получение списков свойств для разных целей - возвращается массив имен свойств
  // Список свойств для привязки к каналу
  // Только из type, calc не брать, command брать, error не брать
  getPropsForHardlink() {
    return Object.keys(this.typeobj.props).filter(prop => this.typeobj.props[prop].op != 'calc');
  }

  // Массив имен свойств - параметров
  getParamProps() {
    return Object.keys(this.typeobj.props).filter(prop => this.getOp(prop) == 'par');
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

  hasCommand(command) {
    return this.isCommand(command);
  }

  inRange(prop, value) {
    const min = this.getMin(prop);
    const max = this.getMax(prop);
    return (min == null || value >= min) && (max == null || value <= max);
  }

  updateAux(prop, auxprop, auxvalue) {
    if (!this._aux[prop]) this._aux[prop] = {};
    this._aux[prop][auxprop] = auxvalue;
  }

  updateAuxArray(arr) {
    if (!arr || !arr.length) return;

    arr.forEach(item => {
      // item.prop, item.auxprop, item.val
      const prop = item.prop;
      if (!this._aux[prop]) this._aux[prop] = {};
      this._aux[prop][item.auxprop] = item.val;
    });
  }

  changeFlatFields(upObj) {
    const fields = deviceutil.getFlatFields();
    fields.forEach(field => {
      if (upObj[field] != undefined) {
        if (field == 'tags') {
          this[field] = Array.isArray(upObj[field]) ? '#' + upObj[field].join('#') + '#' : '';
        } else {
          this[field] = upObj[field];
        }
      }
    });
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

  comply({ did, prop, ts, value, raw, prev, fvalue, changed, err='' }) {
    // Соглашаемся с присланным с worker-a значением, события уже сгенерированы
    if (!prop || !this._raw[prop]) return {};
    
    this[prop] = value; // НОВОЕ ЗНАЧЕНИЕ ЗАПИСАНО В УСТРОЙСТВО
    this._raw[prop].val = value;
    let newerr;
    if (this._raw[prop].err != err) {
      newerr = err;
      this._raw[prop].err = err;
    }

    if (fvalue != undefined) {
      this[prop + '#string'] = fvalue;
      this._raw[prop].fval = fvalue;
    }
    this._raw[prop].ts = ts;
    if (!changed && !newerr) return {};

    // Сохранить в _raw - чтобы при перезагрузке worker-a были данные
    Object.assign(this._raw[prop], { cts: ts, val: value, raw, prev, fval: fvalue });

    const param = this.isParam(prop);
    let txt = '';
    if (prop == 'error' && value ) txt = this.getLastErrStr();
    if (newerr) txt = this.getPropTitle(prop) + ': '+newerr;

    return param || txt || this.getSave(prop) || (prop == 'error' && value)
      ? { did, prop, ts, val: value, prev, raw, param, txt, fval: fvalue, err }
      : {};
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
}

module.exports = Basedevo;
