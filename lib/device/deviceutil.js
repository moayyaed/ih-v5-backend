/**
 * deviceutil.js
 */

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
 * @param {String || undefined} name - имя устройства - системного индикатора
 *        Если не задано - формируется на основе unitId:
 *          Ищется в messages unitId: 'DBHIST' => 'Индикатор базы данных'
 *             если не найдено - 'Индикатор плагина <modbus1>'
 */
function createUnitIndicatorDoc(unitId, name) {
  const _id = getUnitIndicatorId(unitId);
  if (!name) {
    const foundName = appconfig.getMessage(unitId);
    name = foundName != unitId ? foundName : appconfig.getMessage('PluginIndicator') + ' '+unitId;
  }

  const sysObj = { _id, dn: _id, sys: 1, name, type: getSysIndicatorTypeId() };
  liststore.onInsertDocs('device', [sysObj]);
  return sysObj;
}

function getLogMessage(dobj, item) {
  const prop = item.cmd ? item.cmd : item.prop;
  const title = dobj.getPropTitle(prop);

  // TODO - sender??
  if (item.cmd) return 'Команда ' + title;

  if (item.prop && item.val != undefined) return title + ': ' + item.val;

  //
  return '??';
}


function getLogTitleAndMessage(dobj, item) {
  const message = getLogMessage(dobj, item);
  const title = item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdtms') : '';
  return {title, message};
}

module.exports = {
  getDefaultTypeId,
  getSysIndicatorTypeId,
  getUnitIndicatorId,
  createUnitIndicatorDoc,
  getLogMessage,
  getLogTitleAndMessage
};
