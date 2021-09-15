/**
 * devsubset.js
 * Строит массивы dn устройств для групповых операций
 */

// const util = require('util');
// const hut = require('../utils/hut');

module.exports = function(devSet, filter) {
  const result = new Set();
  Object.keys(devSet).forEach(did => {
    const dobj = devSet[did];

    if (isDeviceInFilter(dobj, filter)) {
      result.add(dobj.dn);
    }
  });
  return result;

  // Если фильтр пустой - подходят все устройства
  function isDeviceInFilter(dobj, infilter) {
    const { tag, place } = infilter;
    if (tag) {
      const arrTag = dobj.tags ? dobj.tags.split('#').filter(item => item) : [];
      if (arrTag.indexOf(tag) < 0) return; // не найдено
    }
    if (place) {
      // if (dobj.parent != place && !dobj.location ||  ) return; // м б полностью совпадает или вкл в location
      if (!dobj.location || dobj.location.indexOf('/' + place + '/') < 0) return; // м б полностью совпадает или вкл в location
    }
    return true;
  }
};
