/**
 *  devo.js
 *
 *   Объект устройства: {
 *    _id, dn, name, parent, type, <value, state, battery, auto, ...>, error}
 *          - объект содержит значения свойств, доступен по dn из dnSet (для сценариев)??
 *    typeobj: {}
 *          - ссылка на объект из typestore[type], если тип не определен - на дефолтный тип
 *   _raw: {value:{val, ts, cts, src, err}, auto:{val, ts, cts, src, err}}
 *         - последнее присваивание значения свойству
 *   _aux: Map(key=prop, {min, max, dig,def })
 *         - дополнительные атрибуты свойств
 *    }
 */

const util = require('util');

const hut = require('../utils/hut');

// const staticFields = ['_id', 'dn', 'name', 'parent', 'type'];

class Devo {
  constructor(devDoc, typestore) {
    this.typestore = typestore;
    this._id = devDoc._id;
    this.dn = devDoc.dn;
    this.type = devDoc.type || typestore.DEFAULT_TYPE;

    // Статические поля
    Devo.flatFields().forEach(field => {
      this[field] = devDoc[field] || ''; // ??
    });

    // На уровне устройства создать _raw и _aux
    this._raw = {}; // Для каждого свойства:  последнее значение val, ошибка err, время ts, отправитель src
    this._aux = new Map(); // Для каждого свойства: min,max,def,dig

    this.typeobj = typestore.getTypeObj(this.type); // Вся информация о структуре, типе данных, ф-и - обработчики - здесь
    const proparr = this.typeobj.proparr; // Список свойств в виде массива, только поля для aux
    proparr.forEach(propItem => {
      const prop = propItem.prop;
      if (devDoc.props) {
      this.addProp(prop, propItem, devDoc.props[prop]);
      } else {
        console.log('Not found props: '+this.dn)
      }
    });
  }

  static flatFields() {
    return [ 'name', 'parent'];
  }

  hasProp(prop) {
    return this._aux.has(prop);
  }

  addProp(prop, typePropItem, devPropItem) {
    this._aux.set(prop, { ...typePropItem, ...devPropItem });
    const val = this._aux.get(prop).def;

    this[prop] = val;

    // Для полей calc raw сохраняем как $$$?
    this._raw[prop] = { raw:this.setRaw(prop, val),  val, src: 'def' };
  }

  setRaw(prop, val) {
    return this.typeobj.props[prop].op == 'c' ? '$$$' : val;
  }

  deleteProp(prop) {
    this._aux.delete(prop);
    delete this._raw[prop];
  }

  changeType(type, addProps, deleteProps) {
    this.type = type;
    this.typeobj = this.typestore.getTypeObj(type); 
    this.changeTypeProps(addProps, deleteProps)
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
    })
    
  }

  changeWithRaw() {
    // Пересчитать все ? значения, опираясь на raw (изменилась функция пересчета, min, max, ...)
    // Сформировать chobj 
    const chobj = {};
    Object.keys(this._raw).forEach(prop => {
      if (this._raw[prop].raw != undefined && this._raw[prop].raw != '$$$') {
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
   * @param {Object} chobj - данные от плагина
   *                      {value:42, battery:3000, ts:123456789}
   * @return {Array of Objects} changed - только измененные данные с учетом обработки
   *                      [{did, dn, prop:'value', val:42, ts}, {did, dn, prop:'error', value:'', ts} ]
   */
  change(chobj) {
    const changed = [];
    let errChanged;
    const ts = chobj.ts || Date.now();

    // Обработка полученных свойств
    Object.keys(chobj).forEach(prop => {
      if (this._raw[prop] != undefined) {
        // Несуществующие свойства игнорируются. Свойства ts у устройства быть не должно!!?
        const res = this.changeOne(prop, ts, chobj[prop]); // Возвращает всегда объект c изменениями иначе пустой объект
        if (res.val != undefined) changed.push({ did: this._id, dn: this.dn, prop, value: res.val, ts });

        errChanged = errChanged || res.err != undefined; // Изменилась ошибка свойства в ту или другую сторону
      }
    });

    // Обработка calc свойств
    if (this.typeobj.calc.length && (changed.length || errChanged)) {
      this.typeobj.calc.forEach(calcProp => {
        const res = this.changeOne(calcProp, ts); // Значение для вычисляемых полей не передается
        if (res.val != undefined) changed.push({ did: this._id, dn: this.dn, prop: calcProp, value: res.val, ts });
        errChanged = errChanged || res.err != undefined;
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
  }

  // Возвращает объект {err, val} Если ничего не изменилось - пустой объект
  // При изменении сохраняет в raw и обновляет значение this[prop]
  changeOne(prop, ts, val) {
    const changeres = {};

    this._raw[prop].raw = this.setRaw(prop, val); // Полученное значение всегда сохраняем как raw

    // Присвоить предыдущее значение
    let newerr = this._raw[prop].err;
    let newval = this._raw[prop].val;

    if (this.typeobj.props[prop].readfun) {
      try {
        const res = this.typeobj.props[prop].readfun(this, prop, val); // возвращает значение или объект
        if (typeof res == 'object') {
          if (res.value != undefined) newval = res.value;
          if (res.error != undefined) newerr = res.error;
        } else {
          newval = res;
          newerr = '';
        }
      } catch (e) {
        // Ошибка при выполнении обработчика
        newerr = 'Read handler error! ' + hut.getShortErrStr(e);
      }
    } else {
      newval = val;
    }

    // При изменении значения - записать новые значения
    if (this._raw[prop].val != newval) {
      this._raw[prop].val = newval;
      this._raw[prop].ts = ts;
      this._raw[prop].cts = ts;
      this[prop] = newval;
      changeres.val = newval;
    } else {
      this._raw[prop].ts = ts;
    }

    if (this._raw[prop].err != newerr) {
      this._raw[prop].err = newerr;
      changeres.err = newerr;
    }
    return changeres;
  }
}

// Частные функции модуля

module.exports = Devo;
