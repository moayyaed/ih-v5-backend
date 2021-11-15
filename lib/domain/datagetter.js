/* eslint-disable object-shorthand */
/**
 * datagetter.js
 *
 * Функции подготовки данных
 * на прикладном уровне
 *
 */

const util = require('util');

const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const loadsys = require('../utils/loadsys');

const liststore = require('../dbs/liststore');

const specreq = require('./specreq');
const specform = require('./specform');
const specdata = require('./specdata');
const specsubtree = require('./specsubtree');
const virttables = require('./virttables');
const domaindata = require('./domaindata');
const projectdata = require('./projectdata');
const documentation = require('./documentation');
const scriptdata = require('./scriptdata');
const exportdata = require('./exportdata');
const realtimedata = require('./realtimedata');
const journaldata = require('./journaldata');

const {
  prepareMobileData,
  rebuidDeviceMobileLists,
  rebuidSceneMobileLists,
  rebuidMobilePlaceList
} = require('../mobile/mobiledata');

function isVirttable(tableName) {
  return !!virttables[tableName];
}

async function getVirttable(tableName, dataFromTable, table, cNodeid, item, holder) {
  return isVirttable(tableName) ? virttables[tableName](dataFromTable, table, cNodeid, item, holder) : [];
}

async function getProjectData(type, nodeid, dm) {
  return projectdata.getCachedProjectObj(type, nodeid, dm);
}

// получить данные таблицы для интерфейса:
// method=get&type=table&id=channelsx&nodeid=cctv&rowid=cam1
async function getTable(query, holder) {
  const { id, nodeid, rowid } = query;
  if (isVirttable(id)) return virttables[id]([], id, nodeid, {}, holder);

  // TODO Иначе напрямую читать из таблицы или БД
}

function isSpecMeta(type, id) {
  if (type == 'form') return specform.isSpecForm(id);
}

function isSpec(type, id) {
  // if (type == 'form') return specform.isSpecForm(id);
  if (type == 'popup') return specreq.isSpecPopup(id);
  if (type == 'droplist') return specreq.isSpecDroplist(id);

  if (type == 'subtree') return specsubtree.isSpecSubtree(id);
  if (type == 'tree') return specsubtree.isSpecSubtree(id); // channels as tree
}

async function getSpecMeta(query, dm) {
  if (query && query.type == 'form') return specform.getForm(query, dm);
}

async function getSpecData(query, holder) {
  if (!query) return;
  if (query.type == 'xform') return specdata.getSpecData(query, holder);

  if (query.type == 'popup') return specreq.getSpecPopup(query, holder);
  if (query.type == 'droplist') return specreq.getSpecDroplist(query, holder.dm);
  if (query.type == 'subtree') return specsubtree.getSpecSubtree(query, holder);
}

async function getSpecTree(query, dm) {
  if (query.type == 'tree' || query.type == 'subtree') return specsubtree.getSpecSubtree(query, dm);
}

function getMetaCacheIds(query) {
  return specform.getMetaCacheIds(query);
}

function needFinishing(query) {
  return specreq.needFinishing(query);
}

function finishing(query, data, dm) {
  return specreq.finishing(query, data, dm);
}

function getRecordDependentForms(table) {
  return specform.recordDependentForms[table];
}

async function getRecordIdByLink(formId, nodeid, rowid, dm) {
  if (formId.startsWith('channellink')) {
    // nodeid = d0800.value - найти id записи в таблице devhard, если нет rowid
    if (rowid && rowid != '__clear') return rowid;

    const [did, prop] = nodeid.split('.');
    const hdoc = await dm.dbstore.findOne('devhard', { did, prop });
    // if (!hdoc) throw { err: 'SOFTERR', message: 'Not found channellink record in "devhard" for nodeid:' + nodeid };
    return hdoc ? hdoc._id : '';
  }

  if (formId == 'typeprophandler') {
    return nodeid.split('.').shift();
  }
  return nodeid;
}

function chooseTreeItemComponent(item, desc, dm) {
  if (desc.table == 'units') {
    // Найти в списке
    const listItem = liststore.getItemFromList('unitList', item.id);

    let extratab = 0; // 1 => 'pluginviewPubSub'
    let nochannels = 0; // 1 => 'pluginview1Tab'
    let manifest = dm.getFromCache({ method: 'getmeta', type: 'manifest', id: listItem.plugin });

    if (manifest && manifest.data) {
      extratab = manifest.data.extratab;
      nochannels = manifest.data.nochannels;
    } else {
      // При создании нового плагина манифест еще может быть не загружен
      extratab = appconfig.getPluginManifestProp(listItem.plugin, 'extratab');
      nochannels = appconfig.getPluginManifestProp(listItem.plugin, 'nochannels');
    }
    return nochannels ? 'pluginview1Tab' : extratab ? 'pluginviewPubSub' : 'pluginview';
  }
}

function getTreeItemTitle(table, item, olditem) {
  return domaindata.getTreeItemTitle(table, item, olditem);
}

function getDeviceDidByDn(dn) {
  const listname = dn.startsWith('global') ? 'globalList' : 'deviceList';
  const arr = liststore.getListAsArray(listname);
  for (const item of arr) {
    if (item.dn == dn) return item.id;
  }
}

function getDeviceDnByDid(did) {
  const listname = did.startsWith('gl') ? 'globalList' : 'deviceList';
  const arr = liststore.getListAsArray(listname);
  for (const item of arr) {
    if (item.id == did) return item.dn;
  }
}

function isRealtimeTable(table) {
  return ['unitchannelsTable', 'devicecommonTable'].includes(table);
}

async function getRealtimeValues(table, id, nodeid, holder) {
  switch (table) {
    case 'devicecommonTable':
      if (!holder.devSet[nodeid]) throw { message: 'Not found device ' + nodeid };
      return realtimedata.getDevicecommonTableRtObject(holder.devSet[nodeid], holder);

    case 'unitchannelsTable':
      // каналы плагина - взять также значения привязанных устройств
      //  Вернуть объект, ключ - id канала
      return realtimedata.getUnitchannelsTableRtObject(holder.unitSet[nodeid], holder);
    default:
      return {};
  }
}

function getOneDevicePropRtObject(did, prop, holder) {
  return realtimedata.getOneDevicePropRtObject(did, prop, holder);
}

function formSubTreeLeafItem(doc, id, nodeid) {
  const item = { id: doc._id, title: doc.title || doc.name, parent: doc.parent || 0, order: doc.order };
  if (id == 'channels' && nodeid) {
    item.title = doc.title || doc.name || doc.chan;
    // if (doc.missing) item.title = '✘' + item.title;
    if (doc.missing) item.strike = 1;
    item.component = 'channelview.' + nodeid;
  }
  return item;
}

function formSubTreeBranchItem(doc, id, nodeid) {
  const item = { id: doc._id, title: doc.title || doc.name, parent: doc.parent || 0, order: doc.order };
  if (id == 'channels' && nodeid) {
    item.title = doc.title || doc.chan;
    item.component = 'channelfolder.' + nodeid;
  }
  return item;
}

// col, item, item[col.prop]
function formSmartbutton2Obj(col, item, val) {
  switch (col.prop) {
    case 'dn_prop':
      //  DN002.value => {id:"d0022", prop:'state', dn:'DN002', title:'DN002.value'} id-did устройства
      if (!val || typeof val != 'string') return {};
      if (!val) return {};
      return val.indexOf('.') > 0 ? getObjByDn_prop(val) : {};

    case 'id_prop':
    case 'cmd_prop':
      //  d001.value => {id:"d0022", prop:'state', dn:'DN002', title:'DN002.value'} id-did устройства
      if (!val || typeof val != 'string') return {};
      if (!val) return {};
      return val.indexOf('.') > 0 ? getObjByDid_prop(val) : {};

    default:
      return {};
  }

  function getObjByDn_prop(dn_prop) {
    const [dn, prop] = dn_prop.split('.');
    // По dn найти did
    const id = getDeviceDidByDn(dn);
    return id ? { id, prop, dn, title: dn + '.' + prop } : {};
  }

  function getObjByDid_prop(did_prop) {
    const [did, prop] = did_prop.split('.');

    const dn = getDeviceDnByDid(did);
    return { id: did, prop, dn, title: dn + '.' + prop };
  }
}

function checkDevsExist(devs) {
  if (!devs) return;

  devs
    .split(',')
    .filter(dn => dn)
    .forEach(dn => {
      if (!getDeviceDidByDn(dn)) throw { message: 'Not found ' + dn };
    });
}

function formLinkObj(table, colItem, item, val) {
  return domaindata.formLinkObj(table, colItem, item, val);
}

async function getDroplist(query, holder) {
  const { id, nodeid } = query;
  return isSpec('droplist', id) ? specreq.getSpecDroplist({ id, nodeid }, holder.dm) : domaindata.getDroplist(id);
}

function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';
  return domaindata.getDroplistItemFromList(listdata, key);
}

async function prepareToExport(query, user, holder) {
  return exportdata.prepareToExport(query, user, holder);
}

async function exportOne(query, holder) {
  return exportdata.exportOne(query, holder);
}

/**
 * Возвращает массив объектов [{dn, prop, days:30}]
 * Упорядоченный по days
 *
 * @param {*} query
 * @param {*} holder
 */
async function getDbRetention(query, holder) {
  const docs = await holder.dm.get(
    'devicedb',
    { days: { $gt: 0 }, dbmet: { $gt: 0 } },
    { sort: { days: 1 }, fields: { did: 1, prop: 1, days: 1 } }
  );

  const res = [];
  docs.forEach(item => {
    // Нужен dn вместо did
    if (holder.devSet[item.did] && holder.devSet[item.did].dn) {
      res.push({ dn: holder.devSet[item.did].dn, prop: item.prop, days: item.days });
    }
  });
  return res;
}

/**
 *
 * Упорядоченный по days
 *
 * @param {*} query
 * @param {*} holder
 */
async function getLogRetention(query, holder) {
  const res = {};
  // По def - 1 день
  res.devicelog = await holder.dm.get('device', {}, { sort: { days: 1 }, fields: { did: 1, days: 1 } });
  res.devicelog.forEach(item => {
    if (!item.days) item.days = 1;
  });
  res.pluginlog = await holder.dm.get('units', {}, { sort: { days: 1 }, fields: { unit: 1, days: 1 } });
  res.pluginlog.forEach(item => {
    if (!item.days) item.days = 1;
  });
  return res;
}

async function getLogRetentionDays(query, holder) {
  const res = {};
  const list = await domaindata.getDroplist('journalsrcList', true);
  if (!list || !list.data) {
    console.log('WARN: getLogRetentionDays. Not found journalsrcList');
    return {};
  }
  const tableNames = list.data.map(item => item.id);

  const jlevels = await holder.dm.get('jlevels');
  jlevels.forEach(rec => {
    const name = rec._id;
    if (tableNames.includes(name) && rec.props && typeof rec.props == 'object') {
      const arr = hut.transfromFieldObjToArray(rec.props).sort(hut.byorder('level'));
      if (arr.length) {
        res[name] = arr.map(item => ({ level: item.level, days: item.days || 1 }));
      }
    }
  });
  return res;
}

async function getLogRows(query, holder) {
  return journaldata.getLogRows(query, holder);
}

async function getAlertLogRows(query, holder) {
  return journaldata.getAlertLogRows(query, holder);
}

function getUserTitle(userId) {
  if (!userId) return '';
  const userList = liststore.getListMap('userList');
  return userList.get(userId) ? userList.get(userId).title : '';
}

function getDefaultJournalColumns(table) {
  return journaldata.getDefaultJournalColumns(table);
}

function isSpecSystemData(type, id) {
  return type == 'menu' && id == 'pmmenu';
}

async function getSpecSystemData(query, dm) {
  if (!query || !isSpecSystemData(query.type, query.id)) return;

  if (query.id == 'pmmenu') {
    const data = await loadsys.loadSystemData(query.type, query.id);

    // Проверить наличие модулей;
    for (let i = data.length - 1; i >= 0; i--) {
      const section = data[i].route;
      if (section && appconfig.disSection(section)) {
        data.splice(i, 1);
      }
    }
    return data;
  }
}

function getMethodCacheIds(query) {
  if (query.method == 'getdocs') {
    const ids = ['type', 'id', 'lang', 'platform'];
    const res = [];
    for (let i = 0; i < ids.length; i++) {
      if (!query[ids[i]]) return res;
      res.push(query[ids[i]]);
    }
    return res;
  }
  throw { message: 'Unexpected method in query: ' + util.inspect(query) };
}

// getContent('docs', {id, alias, lang}, dm)
async function getContent(name, query, dm) {
  if (name == 'docs') {
    // вернуть страницу документации из папки для публикации с учетом алиаса
    return documentation.getDocPublicPage(query, dm);
  }
}

async function getFieldFromFile(prop, table, query) {
  // Вернуть код из файла в виде строки
  return scriptdata.get(prop, table, query);
}

module.exports = {
  isVirttable,
  getVirttable,
  getProjectData,

  getTable,
  isSpec,
  isSpecMeta,
  getSpecMeta,
  getSpecData,
  getSpecTree,
  getMetaCacheIds,
  needFinishing,
  finishing,

  getDroplist,
  getDroplistItem,
  getRecordDependentForms,

  prepareToExport,
  exportOne,

  getRecordIdByLink,

  chooseTreeItemComponent,
  getTreeItemTitle,

  isRealtimeTable,
  getRealtimeValues,
  getOneDevicePropRtObject,

  formSubTreeLeafItem,
  formSubTreeBranchItem,
  formLinkObj,
  formSmartbutton2Obj,

  getDeviceDidByDn,
  getDbRetention,
  getLogRetention,
  getLogRetentionDays,
  getLogRows,
  getAlertLogRows,

  getUserTitle,
  getDefaultJournalColumns,

  isSpecSystemData,
  getSpecSystemData,
  checkDevsExist,

  prepareMobileData,
  rebuidDeviceMobileLists,
  rebuidSceneMobileLists,
  rebuidMobilePlaceList,

  getContent,
  getMethodCacheIds,
  getFieldFromFile
};
