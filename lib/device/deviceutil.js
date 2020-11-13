/**
 * deviceutil.js
 */

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

module.exports = {
  getDefaultTypeId,
  getSysIndicatorTypeId,
  getUnitIndicatorId,
  getUnitIndicatorObj
};
