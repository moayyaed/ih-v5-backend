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
const descriptor = require('../descriptor');

const listMap = new Map();
const sTables = {};
// listId  => Map id=> {id, label }

module.exports = {
  start(dm) {
    this.dm = dm;
  },

  async loadList(listname) {
    const listdesc = descriptor.getDescItem('list', listname);

    if (listdesc.table) {
      const desc = descriptor.getTableDesc(listdesc.table);
      const projection = hut.getFieldProjection(listdesc.propmap);
      const data = await this.dm.dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

      // Сделать маппинг полей и сохранить в liststore
      const arr = hut.mapPropsStrict(data, listdesc.propmap);
      this.addList(listname, listdesc.table, arr);
    }

    // Константные списки
    if (listdesc.data) {
      this.addFromArray(listname, listdesc.data);
    }
  },

  addFromArray(listname, dataArr) {
    const dataMap = new Map();
    dataArr.forEach(item => {
      dataMap.set(item.id, item);
    });

    if (!listMap.has(listname)) {
      listMap.set(listname, dataMap);
    } else {
      listMap.set(listname, new Map([...listMap.get(listname), ...dataMap]));
    }
  },

  // Добавить новый список
  addList(listname, table, dataArr) {
    sTables[table] = listname;

    const dataMap = new Map();
    dataArr.forEach(item => {
      dataMap.set(item.id, item);
    });
    listMap.set(listname, dataMap);

    this.dm.on('inserted:' + table, docs => {
      this.onInsertDocs(table, docs);
    });

    this.dm.on('updated:' + table, docs => {
      this.onUpdateDocs(table, docs);
    });

    this.dm.on('removed:' + table, docs => {
      this.onRemoveDocs(table, docs);
    });
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
          const item = Object.assign({}, this.getItemFromList(listname, key), updated, { id: key } );
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

  hasItem(listname, key) {
    return listMap.has(listname) ? listMap.get(listname).has(key) : false;
  },
  
  // Находит первый элемент, удовлетворяющий фильтру и возвращает его
  findItem(listname, filter) {
    if (!listMap.has(listname))  return false;
    for (const value of  listMap.get(listname).values()) {
      if (hut.isInFilter(value, filter)) return value;
    }
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

  getListMap(listname) {
    return listMap.has(listname) ? listMap.get(listname) : new Map();
  },

  getListSize(listname) {
    return listMap.has(listname) ? listMap.get(listname).size : 0;
  },

  // Получить значение по ключу
  getTitleFromList(listname, key) {
    return listMap.has(listname) && listMap.get(listname).has(key) ? listMap.get(listname).get(key).title : '';
  },

  // Получить объект по ключу
  getItemFromList(listname, key) {
    return listMap.has(listname) && listMap.get(listname).has(key) ? listMap.get(listname).get(key) : {id:'-', title:''};
  },

  deleteList(listname) {
    listMap.delete(listname);
  },

  clear() {
    listMap.clear();
  }
};
