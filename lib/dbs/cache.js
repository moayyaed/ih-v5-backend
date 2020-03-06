/**
 * cache.js
 */

const cMap = new Map();
// key => {data, ts}

module.exports = {
  set(key, data) {
    cMap.set(key, {data, ts:Date.now()});
  },

  get(key) {
    // return cMap.has(key) ? cMap.get(key) : '';
    if (!cMap.has(key)) return '';

    return {data: cMap.get(key).data};
    
  
  },

  getData(key) {
    return cMap.has(key) ? cMap.get(key).data : '';
  },

  has(key) {
    return cMap.has(key);
  },

  delete(key) {
    cMap.delete(key);
  },

  clear() {
    cMap.clear();
  }
};