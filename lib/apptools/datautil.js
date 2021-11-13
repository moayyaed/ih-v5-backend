/**
 *
 * Утилиты работы с данными - не прикладной уровень
 *
 */

// const util = require('util');

const hut = require('../utils/hut');

const descriptor = require('../descriptor');
const appconfig = require('../appconfig');

const liststore = require('../dbs/liststore');
const treeguide = require('./treeguide');

const exfieldtypeList = ['code', 'script', 'layout', 'container', 'template', 'dialog', 'markdown'];

function isDerivative(prop) {
  return prop && prop.startsWith('__');
}

function derivativeValue(prop, record) {
  if (record && record[prop]) return record[prop];

  switch (prop) {
    case '__exid':
      return record._id;
    case '__expref':
      return appconfig.get('project_prefix');
    case '__impref':
      return hut.prefAt(record._id);
    case '__currentproject':
      return appconfig.get('project');
    default:
      return '';
  }
}

function isExfieldtype(type) {
  return exfieldtypeList.includes(type);
}

function getEmptyValue(type) {
  switch (type) {
    case 'number':
      return null;
    case 'layout':
      return {};
    case 'container':
      return {};
    case 'template':
      return {};
    case 'cb':
      return 0;
    case 'tags':
      return [];
    default:
      return '';
  }
}

function getPopupFromList(listname) {
  if (liststore.hasList(listname)) {
    return liststore.getListAsArray(listname);
  }
}

async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };
  return liststore.loadList(id);
}

async function getListItem(listname, key) {
  return liststore.getItemFromList(listname, key);
}

function existsListItem(listname, key) {
  const item = liststore.getItemFromList(listname, key);
  return item && item.id == key;
}

// Словарь делается из таблицы
async function createDict(id, dm) {
  const desc = descriptor.getTableDesc(id);
  if (!desc) throw { error: 'SOFTERR', message: 'Not found table for dict creation: ' + id };

  const data = await dm.dbstore.get(desc.collection, {});

  const res = {};
  let key = 'id';
  let val = 'title';

  if (id == 'localList' || 'globalList') {
    key = 'dn';
    val = 'defval';
  }
  data.forEach(item => {
    res[item[key]] = item[val];
  });

  return res;
}

function isLink(nodeid) {
  return nodeid && nodeid.indexOf('.') > 0;
}

function isNewRecord(id) {
  return id && id.startsWith('__new');
}

function getPathFromTree(treeId, nodeId, topNodeId) {
  return treeguide.getPath(treeId, nodeId, topNodeId);
}

function getTreeItem(treeId, nodeId) {
  return treeguide.getItem(treeId, nodeId);
}

function getStatusObj(item, listname, isPlugin) {
  if (!item) return;

  const res = { _id: item.id, name: item.name || item.id, status: '-', uptime: '', blk: item.blk };
  const laststart = item.laststart;
  const laststop = item.laststop;

  if (laststart > 0 && !laststop) {
    res.uptime = hut.timeFormat(Math.floor((Date.now() - laststart) / 1000));
  }
  res.laststart = laststart > 0 ? hut.getDateTimeFor(new Date(laststart)) : '';
  res.laststop = laststop > 0 ? hut.getDateTimeFor(new Date(laststop)) : '';

  if (isPlugin) {
    // 
    res.state = liststore.getTitleFromList(listname, item.state || 0);
    if (item.state == 2) res.state += ', '+appconfig.getMessage('withoutRestart'); // suspend, without restart
    if (item.state > 2) res.state += ', '+appconfig.getMessage('willBeRestarted'); // will be restarted
  } else {
    res.state = item.blk ? 'Blocked' : liststore.getTitleFromList(listname, item.state || 0);
  }
  res.error = item.error || '';
  return res;
}

function getStatusStr(item, name) {
  const res = getStatusObj(item, name);
  let timing = res.laststart ? 'Started ' + res.laststart : '';
  timing += res.laststop ? ' Stopped ' + res.laststop : '';
  timing += res.uptime ? ' Uptime ' + res.uptime : '';
  return res.state + ' ' + timing + ' ' + res.error;
}

function getLogFilename(param, lid) {
  let logfile;
  if (lid && lid.startsWith('__UNIT_')) {
    let name = lid.substr(7);
    if (name == 'mainprocess') {
      logfile = 'ih';
    } else if (name == 'dbagent') {
      // TODO - Может быть другой агент!
      logfile = 'ih_sqlite';
    } else if (name == 'logagent') {
      logfile = 'ih_sqlite_logagent';
    } else {
      logfile = 'ih_' + name;
    }
  } else if (param) {
    logfile = param == 'dblog' ? 'ih_' + lid : 'ih';
  } else {
    logfile = 'ih_' + lid;
  }
  return appconfig.get('logpath') + '/' + logfile + '.log';
}

function addIntegrationToList(unitId, manifest_data) {
  const { servicename, i_devices, i_types } = manifest_data;
  liststore.setItem('integrationList', unitId, { id: unitId, title: servicename || unitId, i_devices, i_types });
}

function removeIntegrationFromList(unitId) {
  liststore.deleteItem('integrationList', unitId);
}


module.exports = {
  isDerivative,
  derivativeValue,

  isExfieldtype,
  getEmptyValue,
  getList,
  createDict,
  getListItem,
  existsListItem,
  isLink,
  isNewRecord,
  getPathFromTree,
  getTreeItem,
  getPopupFromList,
  getStatusObj,
  getStatusStr,
  getLogFilename,
  addIntegrationToList,
  removeIntegrationFromList
};
