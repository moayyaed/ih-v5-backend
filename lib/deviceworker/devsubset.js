/**
 * devsubset.js
 * Строит массивы dn устройств для групповых операций
 */

const hut = require('../utils/hut');

module.exports = function(devSet, filter) {
  const result = new Set();
  Object.keys(devSet).forEach(did => {
    const dobj = devSet[did];

    if (hut.isInFilter(dobj, filter)) {
      result.add(dobj.dn);
    }
  });
  return result;

  /*
  function isDeviceInFilter(dobj, filter) {
    if (!hut.isInFilter(dobj)) return 

  }
  */
};
