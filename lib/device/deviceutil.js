/**
 * deviceutil.js
 */

const hut = require('../utils/hut');

function getDefaultTypeId() {
  return '__DEFAULT_TYPE';
}

function getSysIndicatorTypeId() {
  return '__SYS_INDICATOR';
}

function getUnitIndicatorId(unitId) {
  return '__UNIT_' + unitId;
}

function getUnitIndicatorObj(unitId, name) {
  const _id = getUnitIndicatorId(unitId);
  name = name || 'Indicator ' + unitId;
  return { _id, dn: _id, sys: 1, name, type: getSysIndicatorTypeId() };
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
  getUnitIndicatorObj,
  getLogMessage,
  getLogTitleAndMessage
};
