/**
 * deviceutil.js
 */
// const util = require('util');

const hut = require('../utils/hut');
const liststore = require('../dbs/liststore');
const appconfig = require('../appconfig');

const DeviceFlatFields = ['name', 'parent', 'sys', 'tags'];

function getDefaultTypeId() {
  return '__DEFAULT_TYPE';
}

function getSysIndicatorTypeId() {
  return '__SYS_INDICATOR';
}

function getUnitIndicatorId(unitId) {
  return '__UNIT_' + unitId;
}

function embeddedTypes() {
  return [
    {
      _id: getDefaultTypeId(),
      name: 'Default type',
      props: {
        state: { name: 'State', vtype: 'N', op: 'rw' }
      }
    },
    {
      _id: getSysIndicatorTypeId(),
      sys: 1,
      name: 'System indicator',
      props: {
        state: { name: 'State', vtype: 'N', op: 'rw' },
        version: { name: 'Version', vtype: 'S', op: 'r' },
        memrss: { name: 'Memory RSS', vtype: 'N', op: 'r' },
        memheap: { name: 'Memory Heap Total', vtype: 'N', op: 'r' },
        memhuse: { name: 'Memory Heap Used', vtype: 'N', op: 'r' }
      }
    }
  ];
}

function setChannel(dobj, prop, chanObj) {
  const item = { _id: chanObj._id, unit: chanObj.unit, chan: chanObj.chan };
  if (chanObj.w) {
    if (!dobj._writeSet) dobj._writeSet = {};
    dobj._writeSet[prop] = item;
  }
  if (chanObj.r || !chanObj.w) {
    if (!dobj._readSet) dobj._readSet = {};
    dobj._readSet[prop] = item;
  }
}

function clearChannel(dobj, prop) {
  if (dobj._readSet && dobj._readSet[prop]) dobj._readSet[prop] = '';
  if (dobj._writeSet && dobj._writeSet[prop]) dobj._writeSet[prop] = '';
}
function getFlatFields() {
  return DeviceFlatFields;
}

function changeFlatFields(dobj, upObj) {
  DeviceFlatFields.forEach(field => {
    if (upObj[field] != undefined) {
      if (field == 'tags') {
        dobj[field] = Array.isArray(upObj[field]) ? '#' + upObj[field].join('#') + '#' : '';
      } else {
        dobj[field] = upObj[field];
      }
    }
  });
}

/**
 * Добавляет новое свойство в объект _aux вместе с дополнительными атрибутами (min, max,..)
 * Присваивает дефолтное значение свойству
 * @param {String} prop - имя свойства
 * @param {Object} typePropItem - объект из типа
 * @param {Object} devPropItem - объект из устройства -
 *                 дополнительные атрибуты  могут быть переопределены на уровне устройства
 */
function addProp(dobj, prop, typePropItem, devPropItem) {
  let save = 0; // По умолчанию вЫключено
  if (devPropItem) {
    if (devPropItem.save != undefined) {
      save = devPropItem.save;
    }
  }

  // dobj._aux.set(prop, { ...typePropItem, ...devPropItem, save });
  dobj._aux[prop] = { ...typePropItem, ...devPropItem, save };
  // const val = dobj._aux.get(prop).def;
  const val = dobj._aux[prop].def;

  dobj[prop] = val;
  dobj._raw[prop] = { raw: val, val, src: 'def' }; // Сохраняем информацию о присваивании
}

/**
 * Удаляет свойство
 * @param {String} prop - имя свойства
 */
function deleteProp(dobj, prop) {
  dobj._aux.delete(prop);
  delete dobj._raw[prop];
  delete dobj[prop];
}

/**
 * Системные индикаторы для плагинов, агентов в devices не хранятся, создаются на лету
 *   Документ сразу передается в liststore, чтобы индикатор появился в списке  deviceList
 *
 * @param {String} unitId - id плагина, на его основе строится id устройства
 *     !! Для dbagent-a не unitId из unitSet (influx, mysql) - а всегда dbagent
 * @param {Object} manifest -  объект - манифест (считан из файла манифеста)
 *        Имя формируется на основе unitId:
 *          Ищется в messages unitId: 'dbagent' => 'Индикатор базы данных'
 *             если не найдено - 'Индикатор плагина <modbus1>'
 */
function createUnitIndicatorDoc(unitId, manifest) {
  const _id = getUnitIndicatorId(unitId);

  const foundName = appconfig.getMessage(unitId);
  const name = foundName != unitId ? foundName : appconfig.getMessage('PluginIndicator') + ' ' + unitId;

  const sysObj = { _id, dn: _id, sys: 1, name, type: getSysIndicatorTypeId() };
  if (unitId == 'mainprocess') sysObj.parent = appconfig.getConfTitle();
  // if (unitId == 'dbagent' || unitId == 'logagent')  sysObj.parent = 'sqlite';
  if (unitId == 'logagent') sysObj.parent = 'sqlite';

  if (manifest) {
    if (manifest.ext) sysObj.extProps = hut.clone(manifest.ext);
  }
  liststore.onInsertDocs('device', [sysObj]);
  return sysObj;
}

function removeUnitIndicatorDoc(unitId) {
  const _id = getUnitIndicatorId(unitId);
  liststore.onRemoveDocs('device', [{ _id }]); // Удалить из deviceList, так как добавляли вручную
}

function getLogMessage(dobj, item) {
  if (item.prop == 'error') {
    return item.val ? appconfig.getMessage('ERROR') + '! ' + item.txt : '';
  }

  if (item.txt) return item.txt;

  const title = getTitle();
  // TODO - sender??
  let str = '';
  if (item.cmd) {
    str = appconfig.getMessage('COMMAND') + ': ' + title;
  } else if (item.val != undefined) {
    str = title + ': ' + item.val;
  }
  /*
  } else if (item.prop && item.val != undefined) {
    str = title + ': ' + dobj.formatValue(item.prop, item.val);
  }
  */
  addSender();
  return item.err ? str + ' ' + item.err : str;

  function getTitle() {
    if (!item.cmd) return dobj.getPropTitle(item.prop);
    // return item.cmd == 'set' ? 'SET ' + dobj.getPropTitle(item.prop) + ':' + item.val : dobj.getPropTitle(item.cmd);
    return item.cmd == 'set' ? dobj.getPropTitle(item.prop) + '=' + item.val : dobj.getPropTitle(item.cmd);
  }

  function addSender() {
   
    if (item.sender) {
      // console.log('WARN: SENDER = '+item.sender+' typeof ='+typeof sender)
      str += ' ' + item.sender;
    }  
  }
}

function getLogTitleAndMessage(dobj, item) {
  const message = getLogMessage(dobj, item);
  const title = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdtms') : '';
  return { title, message };
}

function getDevicePlacePath(did, holder, itemProp = 'title') {
  const dobj = holder.devSet[did];
  if (!dobj || !dobj.parent) return '';

  let key = dobj.parent;
  const arr = [];
  while (key && key != 'place') {
    const item = liststore.getItemFromList('placeList', key);
    arr.unshift(item[itemProp]);
    // arr.unshift(item.title);
    key = item.parent;
  }
  return itemProp == 'title' ? arr.join(' / ') : arr.join('/');
}

function getDevobjPlaceStr(dobj, itemProp = 'title') {
  const arr = getDevobjPlaceArr(dobj, itemProp)
  return arr.join(' ');
}

function getDevobjPlacePath(dobj, itemProp = 'title') {
  const arr = getDevobjPlaceArr(dobj, itemProp)
  return itemProp == 'title' ? arr.join(' / ') : arr.join('/');
}

function getDevobjPlaceArr(dobj, itemProp = 'title') {
  if (!dobj) return [];
  let key = dobj.parent;
  const arr = [];
  while (key && key != 'place') {
    const item = liststore.getItemFromList('placeList', key);
    arr.unshift(item[itemProp]);
    key = item.parent;
  }
  return arr;
}


function getLocation(did, holder) {
  return '/place/'+getDevicePlacePath(did, holder, 'id');
}

module.exports = {
  getFlatFields,
  getDefaultTypeId,
  getSysIndicatorTypeId,
  getUnitIndicatorId,
  embeddedTypes,
  createUnitIndicatorDoc,
  removeUnitIndicatorDoc,
  getLogMessage,
  getLogTitleAndMessage,
  getDevicePlacePath,
  getLocation,
  getDevobjPlacePath,
  getDevobjPlaceStr,
  getDevobjPlaceArr,

  addProp,
  deleteProp,
  setChannel,
  clearChannel,
  changeFlatFields
};
