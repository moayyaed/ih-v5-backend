/**
 * Хранилище списков
 * Использование:
 *   1. Получить список для droplist-а
 *   2. Получить значение при формировании type:droplist и в других случаях
 * 
 *   
 */
const util = require('util');


const listMap = new Map();
// listId  => Map id=> {id, label }

module.exports = {
  // Добавить новый список
  addList(listname, dataArr) {
    const dataMap = new Map();
    dataArr.forEach(item => {
      dataMap.set(item.id, item);
    })
    listMap.set(listname, dataMap);
  },

  hasList(listname) {
    return listMap.has(listname);
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