/**
 * devsubset.js
 * Строит массивы dn устройств для групповых операций
 */

const util = require('util');
// const hut = require('../utils/hut');

module.exports = function(devSet, filter) {
  const result = new Set();
  Object.keys(devSet).forEach(did => {
    const dobj = devSet[did];

    // if (hut.isInFilter(dobj, filter)) {
    if (isDeviceInFilter(dobj, filter)) {
      result.add(dobj.dn);
    }
  });
  return result;

  function isDeviceInFilter(dobj, infilter) {
    const { tag, place } = infilter;
    console.log('isDeviceInFilter tag='+tag+' dobj.tags='+util.inspect(dobj.tags));
    if (tag) {
      const arrTag = dobj.tags ? dobj.tags.split('#').filter(item => item) : [];
      if (arrTag.indexOf(tag) < 0) return;
    }
    if (place) {
      if (dobj.parent != place) return;
    }

    return true;
  }
};
