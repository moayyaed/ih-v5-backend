/**
 * cache.js
 */

// const descriptor = require('./descriptor');
const util = require('util');

module.exports = {
  
   // invalidateList -  объект для инвалидации кэша при редактировании таблиц 
  start(invalidateList) {
    this.cMap = new Map();
    this.invalidateList = invalidateList;
  },

  set(key, data) {
    this.cMap.set(key, { data, ts: Date.now() });
  },

  get(key) {
    // return cMap.has(key) ? cMap.get(key) : '';
    if (!this.cMap.has(key)) return '';

    return { data: this.cMap.get(key).data };
  },

  getData(key) {
    return this.cMap.has(key) ? this.cMap.get(key).data : '';
  },

  getTs(key) {
    return this.cMap.has(key) ? this.cMap.get(key).ts : 0;
  },

  getKeys() {
    return this.cMap.keys();
  },

  has(key) {
    return this.cMap.has(key);
  },

  delete(key) {
    this.cMap.delete(key);
  },

  invalidate(table) {
    const keysToClear = this.invalidateList[table];

    this.invalidateKeys(keysToClear);
  },

  invalidateKeys(keysToClear) {
    if (keysToClear) keysToClear.forEach(key => {
      if (key.length > 1 && key.endsWith('*')) {
        this.deleteStartsWith(key.substr(0,key.length-1));
      } else this.delete(key);
    });
  },


  deleteStartsWith(str) {
    const toDelete = [];
    for (const key of this.cMap.keys()) {
      if (key.startsWith(str)) {
        toDelete.push(key)
      }
    }
    console.log('cache To Delete '+util.inspect(toDelete))
    toDelete.forEach(key => this.delete(key));
  },

  clear() {
    this.cMap.clear();
  }
};
