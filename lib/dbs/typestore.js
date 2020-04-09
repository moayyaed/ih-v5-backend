/**
 * Хранилище типов для работы с устройствами
 * Использование:
 *   1. При создании устройств заданного типа
 *   2. Генерация dn по префиксам
 *   3. Названия и атрибуты свойств устройств при оперативной работе 
 *
 */
// const util = require('util');

const hut = require('../utils/hut');

// Сформировать typeMap из таблицы types :{_id:тип, props:{value:{vtype, op, min, max,...}}}
const typeMap = new Map();
const dnPrefIds = {}; // [pref]:{len, numid}

const DEFAULT_TYPE = 't100';

module.exports = {
  create(typeDocs, deviceDocs) {
    typeMap.clear();
    typeDocs.forEach(item => this.addItem(item)); // props преобразуется в массив свойств
    deviceDocs.forEach(item => this.updateDnPref(item.dn));
  },

  addItem(item) {
    if (item.props) {
      typeMap.set(item._id, { item, proparr: hut.objectToArray(item.props, 'prop') });
    }
  },

  updateItem(id, newitem) {
    // {item: {_id, name, ruledn_pref}, proparr:[{ prop: 'value', name: 'Значение', vtype: 'B', op: 'r' },]
    const curItem = typeMap.get(id).item;
    Object.assign(curItem, newitem);
  },

  deleteItem(id) {
    typeMap.delete(id);
  },

  clear() {
    typeMap.clear();
  },

  // Генерирует объект props для заданного типа устройства
  createPropsFromType(typeId) {
    const props = {};
    if (typeMap.has(typeId)) {
      const arr = typeMap.get(typeId).proparr;
      arr.forEach(propItem => {
        props[propItem.prop] = { db: propItem.db || 0 };
        if (propItem.vtype == 'N') {
          props[propItem.prop].min = propItem.min || null;
          props[propItem.prop].max = propItem.max || null;
          props[propItem.prop].dig = propItem.dig || 0;
        }
      });
    }
    return props;
  },

  // Генерирует новый dn для заданного типа устройства
  createDnFromType(typeId) {
    let pref = 'DN';
    if (typeMap.has(typeId)) {
      const typeItem = typeMap.get(typeId).item;
      if (typeItem.ruledn_pref) pref = typeItem.ruledn_pref;
    }
    return this.getNewDn(pref);
  },

  getNameFromType(typeId) {
    return typeMap.has(typeId) ? typeMap.get(typeId).item.name : '';
  },

  createDeviceDoc(doc, type) {
    type = type || DEFAULT_TYPE;

    doc.props = this.createPropsFromType(type);
    doc.dn = this.createDnFromType(type);
    doc.name = this.getNameFromType(type);
    doc.type = type;
    return doc;
  },

  // Для генерации dn на основании префиксов
  // В каждом dn выделяем префикс, для одинаковых префиксов - сохранить мах значение мах длины
  getNewDn(pref) {
    if (!pref) return '';

    if (!dnPrefIds[pref]) {
      dnPrefIds[pref] = { len: 2, numid: 0 };
    }
    const rule = dnPrefIds[pref];
    rule.numid += 1;

    return pref + String(rule.numid).padStart(rule.len, '0');
  },

  getNewDnAsCopy(dn) {
    if (dn) {
      let pref = dn;
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        pref = dn.substr(0, marr.index);
      }
      return this.getNewDn(pref);
    }
    return '';
  },

  // Может присвоиться пользователем - нужно обновлять
  updateDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];
        if (!dnPrefIds[pref]) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len < dig.length) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len == dig.length) {
          if (Number(dig) > dnPrefIds[pref].numid) {
            dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
          }
        }
      }
    }
  },

  deleteDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];

        if (dnPrefIds[pref]) {
          if (dig.length >= dnPrefIds[pref].len && Number(dig) == dnPrefIds[pref].numid) {
            dnPrefIds[pref].numid -= 1;
          }
        }
      }
    }
  }
};
