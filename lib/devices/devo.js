/**
 *
 */

const util = require('util');

const staticFields = ['_id', 'dn', 'name', 'parent', 'type'];

class Devo {
  constructor(devDoc, typestore) {
    // Всю статическую информацию, включая  _id, переносим. Все поля должны быть??
    staticFields.forEach(prop => {
      this[prop] = devDoc[prop] || ''; // ??
    });

     
    this._raw = new Map(); // 
    this._db = new Map();  // 
    this._aux = new Map(); // 
    

    // Также пришли поля в свойстве props, и значения атрибутов для каждого свойства
    // Их нужно перенести, стыковав с описанием типа?
    const props = typestore.getPropArray(devDoc.type);
    console.log('devDoc.type='+devDoc.type+' props='+util.inspect(props));
       
    props.forEach(propItem => {
      const prop = propItem.prop;
      this._aux.set(prop, {...getAuxFromType(propItem), ...propItem });
      const val = this._aux.get(prop).def;

      // Присвоить дефолтное значение. Если устр-во уже сущ, должно быть заменено на текущее позже
      // Это фиксация последнего поступления. TODO - Нужен еще журнал устройства
      this[prop] = val;
      this._raw.set(prop, { val, src: 'def' });
    });
    
  }

  get error() {
    for (let [key, value] of this._raw) {
      if (value.err) return true;
    }
  }

  getProp(prop) {
    return this[prop];
  }

  setProp(prop, value) {
    this[prop] = value;
  }

  getMin(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).min : null;
  }

  getMax(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).max : null;
  }

  getDefault(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).def : null;
  }

  getDig(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).dig : 0;
  }

  isInRange(prop, value) {
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

  setRawPropsFromObj(prop, inObj) {
    if (!this._raw.has(prop)) this._raw.set(prop, {}); // this._aux.value = {min, max, ...}
    this._raw.set(prop, Object.assign(this._raw.get(prop), inObj));
    return this._raw.get(prop);
  }
}

// Частные функции модуля
function getAuxFromType(typePropItem) {
  const res = { vtype: typePropItem.vtype, op: typePropItem.op };
  switch (typePropItem.vtype) {
    case 'N':
      res.min = typePropItem.min || null;
      res.max = typePropItem.max || null;
      res.dig = typePropItem.dig || 0;
      res.def = typePropItem.def || 0;
      break;
    case 'S':
      res.def = typePropItem.def || '';
      break;
    case 'B':
      res.def = typePropItem.def || 0;
      break;
    default:
  }
  return res;
}

module.exports = Devo;
