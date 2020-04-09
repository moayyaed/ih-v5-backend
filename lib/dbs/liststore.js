/**
 * Хранилище списков
 * Использование:
 *   1. Получить список для droplist-а
 *   2. Получить значение при формировании type:droplist и в других случаях
 *
 *
 */
const util = require('util');

const hut = require('../utils/hut');
const descriptor = require('../dbs/descriptor');

const listMap = new Map();
const sTables = {};
// listId  => Map id=> {id, label }

module.exports = {
  // Добавить новый список
  addList(listname, table, dataArr) {
    sTables[table] = listname;

    const dataMap = new Map();
    dataArr.forEach(item => {
      dataMap.set(item.id, item);
    });
    listMap.set(listname, dataMap);
  },

  hasList(listname) {
    return listMap.has(listname);
  },

  onUpdateDocs(table, docs) {
    if (!sTables[table]) return;

    const listname = sTables[table];
    const listdesc = descriptor.getDescItem('list', listname);
    docs.forEach(doc => {
      if (doc._id && doc.$set) {
        const updated = hut.getStrictMappedObj(doc.$set, listdesc.propmap);
        if (!hut.isObjIdle(updated)) {
          const key = doc._id;
          const item = Object.assign({ id: key }, this.getItemFromList(listname, key), updated);
          this.setItem(listname, key, item);
        }
      }
    });
  },

  onInsertDocs(table, docs) {
    if (!sTables[table]) return;

    const listname = sTables[table];
    const listdesc = descriptor.getDescItem('list', listname);
    const arr = hut.mapPropsStrict(docs, listdesc.propmap);
    arr.forEach(item => this.setItem(listname, item.id, item));
  },

  onRemoveDocs(table, docs) {
    if (!sTables[table]) return;

    const listname = sTables[table];
    const listdesc = descriptor.getDescItem('list', listname);
    const arr = hut.mapPropsStrict(docs, listdesc.propmap);
    arr.forEach(item => this.deleteItem(listname, item.id));
  },

  setItem(listname, key, item) {
    if (!listMap.has(listname)) return;
    listMap.get(listname).set(key, item);
  },

  deleteItem(listname, key) {
    if (!listMap.has(listname)) return;
    listMap.get(listname).delete(key);
  },

  // Получить массив (для droplist)
  getListAsArray(listname) {
    return listMap.has(listname) ? Array.from(listMap.get(listname).values()) : [];
  },

  getListSize(listname) {
    return listMap.has(listname) ? listMap.get(listname).size : 0;
  },

  // Получить значение по ключу
  getLableFromList(listname, key) {
    return listMap.has(listname) && listMap.get(listname).has(key) ? listMap.get(listname).get(key).label : '';
  },

  // Получить объект по ключу
  getItemFromList(listname, key) {
    return listMap.has(listname) && listMap.get(listname).has(key) ? listMap.get(listname).get(key) : {};
  },

  deleteList(listname) {
    listMap.delete(listname);
  },

  clear() {
    listMap.clear();
  }
};
