/**
 * integrationmethods.js
 * 
 * Методы формирования данных для интеграций
 */


const typestore = require('../device/typestore');

/**
 * Формирует массив данных устройств, которые задействованы в интеграции
 * Добавляется текущее значение всех свойств, которые мапятся
 *
 * @param {*} unitId
 * @param {*} holder
 */
async function getDevices(unitId, holder) {
  const docs = await holder.dm.dbstore.get('integrations', { app: unitId, active: 1 });
  const arr = [];
  docs.forEach(doc => {
    const dobj = holder.devSet[doc.did];
    if (dobj) {
      const { _id, app, active, ...robj } = doc;
      robj.dn = dobj.dn;
      robj.values = {};

      // TODO Выбрать значения замапленных свойств
      const propArr = getDeviceMappedPropsArray(unitId, doc, holder);
      propArr.forEach(prop => {
        robj.values[prop] = dobj[prop] || 0;
      });
      arr.push(robj);
    }
  });
  return arr;
}

function getDeviceMappedPropsArray(unitId, doc, holder) {
  const mpropArr = [];
  // Собрать свойства устройства, выделить те которые мапятся для автоматизации
  const devPropSet = getDevPropSet(holder.devSet[doc.did]);
  if (devPropSet.size) {
    Object.keys(doc).forEach(prop => {
      if (devPropSet.has(doc[prop])) {
        mpropArr.push([doc[prop]]);
      }
    });
  }
  return mpropArr;
}

function getDevPropSet(dobj) {
  let propArr = [];
  if (dobj && dobj.type) {
    propArr = typestore.getPropNameArray(dobj.type);
  }
  return new Set(propArr);
}

module.exports = {
  applehomekit: {
    getDevices,
    getDeviceMappedPropsArray
  }
};
