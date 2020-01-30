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
    return cMap.has(key) ? cMap.get(key) : '';
  },

  getData(key) {
    return cMap.has(key) ? cMap.get(key).data : '';
  },

  has(key) {
    return cMap.has(key);
  },
  clear() {
    cMap.clear();
  }
};