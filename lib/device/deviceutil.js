/**
 * deviceutil.js
 */
// const util = require('util');

const hut = require('../utils/hut');
const liststore = require('../dbs/liststore');
const appconfig = require('../appconfig');

function getDefaultTypeId() {
  return '__DEFAULT_TYPE';
}

function getSysIndicatorTypeId() {
  return '__SYS_INDICATOR';
}

function getUnitIndicatorId(unitId) {
  return '__UNIT_' + unitId;
}

/**
 * Системные индикаторы для плагинов, агентов в devices не хранятся, создаются на лету
 *   Документ сразу передается в liststore, чтобы индикатор появился в списке  deviceList
 *
 * @param {String} unitId - id плагина, на его основе строится id устройства
 *     !! Для dbagent-a не unitId из unitSet (influx, mysql) - а всегда dbagent
 * @param {String || undefined} name - имя устройства - системного индикатора
 *        Если не задано - формируется на основе unitId:
 *          Ищется в messages unitId: 'dbagent' => 'Индикатор базы данных'
 *             если не найдено - 'Индикатор плагина <modbus1>'
 */
function createUnitIndicatorDoc(unitId, name) {
  const _id = getUnitIndicatorId(unitId);
  if (!name) {
    const foundName = appconfig.getMessage(unitId);
    name = foundName != unitId ? foundName : appconfig.getMessage('PluginIndicator') + ' ' + unitId;
  }

  const sysObj = { _id, dn: _id, sys: 1, name, type: getSysIndicatorTypeId() };
  liststore.onInsertDocs('device', [sysObj]);
  return sysObj;
}

function removeUnitIndicatorDoc(unitId) {
  const _id = getUnitIndicatorId(unitId);
  liststore.onRemoveDocs('device', [{ _id }]); // Удалить из deviceList, так как добавляли вручную
}
function getLogMessage(dobj, item) {
  if (item.prop == 'error') {
    return item.val ? appconfig.getMessage('ERROR')+'! ' + item.txt : '';
  }

  const title = getTitle();
  // TODO - sender??
  let str = '';
  if (item.cmd) {
    str = appconfig.getMessage('COMMAND') +' '+ title;
  } else if (item.prop && item.val != undefined) {
    str = title + ': ' + item.val;
  }
  return item.err ? str + ' ' + item.err : str;

  function getTitle() {
    if (!item.cmd) return dobj.getPropTitle(item.prop);
    return item.cmd == 'set' ? 'SET ' + dobj.getPropTitle(item.prop) + ':' + item.val : dobj.getPropTitle(item.cmd);
  }
}

function getLogTitleAndMessage(dobj, item) {
  const message = getLogMessage(dobj, item);
  const title = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdtms') : '';
  return { title, message };
}

async function customValidate({ prop, doc, _id }) {
  const val = doc[prop];
  if (prop == 'fn_opt_str' && val) return tryParse(val);
}

function tryParse(val) {
  try {
    const res = JSON.parse(val);
    if (typeof res != 'object') throw  {message:'Expect options object!'}
  } catch (e) {
    return 'ERROR: ' + val + ': ' + hut.getShortErrStr(e);
  }
}

module.exports = {
  getDefaultTypeId,
  getSysIndicatorTypeId,
  getUnitIndicatorId,
  createUnitIndicatorDoc,
  removeUnitIndicatorDoc,
  getLogMessage,
  getLogTitleAndMessage, 
  customValidate
};
