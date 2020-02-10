/**
 * 
 */

module.exports = class Devo {
  constructor(staticInfo, typePropsArr, devProps) {
    this._raw = new Map();
    this._db = new Map();
    this._aux = new Map();

    typePropsArr.forEach(propItem => {
      const prop = propItem.prop;
      this._raw.set(prop,propItem ); // НЕТ!! Нужно взять значения из devProps
      this[prop] = '';
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
    return this._aux.has(prop) ? this._aux.get(prop).min : null ;
  }

  getMax(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).max : null ;
  }

  getDefault(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).def : null ;
  }

  getTimeout(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).tot : 0 ;
  }

  getDig(prop) {
    return this._aux.has(prop) ? this._aux.get(prop).dig : 0 ;
  }

  isInRange(prop, value) {
    const min = this.getMin(prop);
    const max = this.getMax(prop);
    return (min == null || value>=min) && (max == null || value<=max);
  }
};