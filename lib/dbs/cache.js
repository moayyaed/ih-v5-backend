/**
 * cache.js
 */

// const descriptor = require('./descriptor');

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
    console.log('invalidateCache ' + keysToClear);
    if (keysToClear) keysToClear.forEach(key => this.delete(key));
  },

  clear() {
    this.cMap.clear();
  }
};
