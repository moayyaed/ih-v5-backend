/* eslint-disable object-shorthand */
/**
 * datagetter.js
 *
 * Функции подготовки данных
 * на прикладном уровне
 *
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');

const dm = require('../datamanager');
const appconfig = require('../appconfig');

const liststore = require('../dbs/liststore');
const typestore = require('../device/typestore');
// const deviceutil = require('../device/deviceutil');

const emObj = { '0': '❏', '1': '✔︎', '2': '✘' };

async function getRecordIdByLink(formId, nodeid, rowid) {
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

function chooseTreeItemComponent(item, desc) {
  if (desc.table == 'units') {
    // Найти в списке
    const listItem = liststore.getItemFromList('unitList', item.id);
    // Здесь нужно расширить логику!!
    // return listItem.id == listItem.plugin ? 'pluginview1Tab' : 'pluginview';

    const manifest = dm.getFromCache({method:'getmeta', type:'manifest', id: listItem.plugin});

    const ext = manifest && manifest.data && manifest.data.extrapattern;
    return listItem.id == listItem.plugin
      ? 'pluginview1Tab'
      : ext  // : listItem.plugin.startsWith('mqtt')
      ? 'pluginviewPubSub'
      : 'pluginview';
  }

  if (desc.table == 'multiscenegroup') {
    return item.id == 'multiscenegroup' ? 'multiscenefolder' : 'multiscenescript';
  }
}

function getTreeItemTitle(table, item, olditem) {
  let title = item && item.name ? item.name : olditem && olditem.name ? olditem.name : '';
  if (table.startsWith('device')) {
    title = getDeviceTitle(item._id || olditem._id);
  } else if (table == 'scene') {
    title = getSceneTitle(item._id || olditem._id);
  } else if (table == 'units') {
    title = item._id || (olditem && olditem._id) || '';
  } else if (table == 'devhard') {
    title = item.chan || (olditem && olditem.chan) || '';
  } else if (table == 'project') {
    title = getProjectTitle(item._id || olditem._id);
  } else if (table == 'dbagent') {
    title = getDbagentTitle(item._id || olditem._id);
  }
  if (!title) title = item.title || (olditem && olditem.title);

  return title;
}

function getListItem(listname, id) {
  return liststore.getItemFromList(listname, id);
}

function getProjectTitle(id) {
  const item = liststore.getItemFromList('projectList', id);
  return formTitle('projectList', item);
}

function getDbagentTitle(id) {
  const item = liststore.getItemFromList('dbagentList', id);
  return formTitle('dbagentList', item);
}

function getDeviceTitle(did, prop) {
  const listname = isGlobal(did) ? 'globalList' : 'deviceList';
  const item = liststore.getItemFromList(listname, did);
  return !item || !item.dn ? did + ': Not found ' : formTitle(listname, item) + (prop ? ' ▪︎ ' + prop : '');
}

function getDeviceDn(did) {
  const listname = isGlobal(did) ? 'globalList' : 'deviceList';
  const item = liststore.getItemFromList(listname, did);
  return !item || !item.dn ? did + ': Not found ' : item.dn;
}

function getDeviceDidByDn(dn) {
  const listname = dn.startsWith('global') ? 'globalList' : 'deviceList';
  const arr = liststore.getListAsArray(listname);
  for (const item of arr) {
    if (item.dn == dn) return item.id;
  }
}

function getDeviceFormUrl(did) {
  switch (getDeviceKind(did)) {
    case 'gl':
      return 'dev/globals/globalview/' + did + '/tabGlobalCommon';
    case 'sys':
      return 'dev/sysdevices/sysdeviceview/' + did + '/tabSysDeviceCommon';
    default:
      return 'dev/devices/deviceview/' + did + '/tabDeviceTable';
  }
}

function getDeviceDbFormUrl(did) {
  switch (getDeviceKind(did)) {
    case 'gl':
      return 'dev/globals/globalview/' + did + '/tabGlobalCommon';
    case 'sys':
      return 'dev/sysdevices/sysdeviceview/' + did + '/tabSysDeviceCommon';
    default:
      return 'dev/devices/deviceview/' + did + '/tabDeviceDb';
  }
}

function getDeviceKind(did) {
  if (isSysDevice(did)) return 'sys';
  if (isGlobal(did)) return 'gl';
  return 'device';
}

function getSceneTitle(id) {
  const item = liststore.getItemFromList('sceneList', id);
  return item ? formTitle('sceneList', item) : id + ': Scene not found';
}

function formTitle(listname, item) {
  let emo;
  switch (listname) {
    case 'deviceList':
      return item.dn + ' ▪︎ ' + item.name;
    case 'sceneList':
      // emo = emObj[item.status] || emObj['0'];
      // return emo + ' ' + item.name;
      return item.name;

    case 'unitList':
      return item.id;

    case 'projectList':
      emo = item.active ? emObj[1] + ' ' : '';
      return emo + item.title;

    case 'dbagentList':
      emo = item.active ? emObj[1] + ' ' : '';
      return emo + item.title;
    default:
      return item.title || item.name;
  }
}

function isRealtimeTable(table) {
  return ['unitchannelsTable', 'devicecommonTable'].includes(table);
}

function getRealtimeValues(table, id, nodeid, holder) {
  switch (table) {
    case 'devicecommonTable':
      if (!holder.devSet[nodeid])
        throw { err: 'SOFTERR', message: 'Not found device ' + nodeid + ' in holder.devSet ' };
      return getDevicecommonTableRtObject(holder.devSet[nodeid], holder);

    case 'unitchannelsTable':
      // каналы плагина - взять также значения привязанных устройств
      //  Вернуть объект, ключ - id канала
      return getUnitchannelsTableRtObject(holder.unitSet[nodeid], holder);
    default:
      return {};
  }
}

function getUnitchannelsTableRtObject(unitItem, holder) {
  if (!unitItem || !unitItem.chano || !unitItem.chano.channels) return {};
  const robj = {};

  const unitChanObj = unitItem.chano;

  unitChanObj.charr.forEach(item => {
    robj[item.chan] = {
      realtime_chan_value: '',
      realtime_chan_ts: '',
      realtime_dev_value: '',
      realtime_dev_ts: '',
      realtime_dev_err: '',
      realtime_dev_cts: ''
    };

    if (unitChanObj.channels[item.chan]) {
      robj[item.chan].realtime_chan_val = unitChanObj.channels[item.chan].val;
      robj[item.chan].realtime_chan_ts = unitChanObj.channels[item.chan].ts;
    }

    if (item.did && item.prop && holder.devSet[item.did]) {
      const devRaw = holder.devSet[item.did]._raw;
      if (devRaw[item.prop]) {
        robj[item.chan].realtime_dev_val = devRaw[item.prop].val;
        robj[item.chan].realtime_dev_ts = devRaw[item.prop].ts;
        robj[item.chan].realtime_dev_cts = devRaw[item.prop].cts;
        robj[item.chan].realtime_dev_err = devRaw[item.prop].err;
      }
    }
  });
  return robj;
}

// function getDevicecommonTableRtObject(devItem, holder) {
function getDevicecommonTableRtObject(devItem) {
  if (!devItem) return {};
  const robj = {};

  // Внутри устройства по свойствам
  const devRaw = devItem._raw;

  Object.keys(devRaw).forEach(prop => {
    robj[prop] = {};
    robj[prop].realtime_dev_val = devRaw[prop].val;
    robj[prop].realtime_dev_ts = devRaw[prop].ts;
    robj[prop].realtime_dev_cts = devRaw[prop].cts;
    robj[prop].realtime_dev_err = devRaw[prop].err;

    // Вытащить данные по привязанному каналу
  });

  return robj;
}

function formSubTreeLeafItem(doc, id, nodeid) {
  const item = { id: doc._id, title: doc.title || doc.name, parent: doc.parent || 0, order: doc.order };
  if (id == 'channels' && nodeid) {
    item.title = doc.chan;
    item.component = 'channelview.' + nodeid;
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

    default:
      return {};
  }

  function getObjByDn_prop(dn_prop) {
    const [dn, prop] = dn_prop.split('.');
    // По dn найти did
    const id = getDeviceDidByDn(dn);
    return id ? { id, prop, dn, title: dn + '.' + prop } : {};
  }
}

function formLinkObj(table, colItem, item, val) {
  if (!val) return { title: '', path: '' };
  // Нужно сформировать title для устройства и для канала
  let path = '';
  switch (colItem.prop) {
    case 'title':
      return getTitleLinkObj(table, item.id, item);
    // return table.indexOf('device')>=0 ?  getDeviceLinkObj(item.id) : { title: val, path };
    case 'dn':
      return getDeviceLinkObj(item._id);
    case 'type':
      return getTypeLinkObj(table, item._id, item);
    case 'did':
      return getDeviceLinkObj(item.did);
    // return { title: getDeviceTitle(val), path: getDeviceTitle(val) };
    case 'chan':
      return getChannelLinkObj(item._id, item.unit, item.chan);
    // path = `datasource/plugins/pluginview/${item.unit}/tabUnitChannels/channelview.${item.unit}/${item._id}`;
    // return { title: `${item.unit}.${item.chan}`, path };
    default:
      return { title: val, path };
  }
}

function getDeviceLinkObj(did, prop) {
  return { title: getDeviceTitle(did, prop), path: getDeviceFormUrl(did) };
}

function getChannelLinkObj(id, unit, chan) {
  const path = `datasource/plugins/pluginview/${unit}/tabUnitChannels/channelview.${unit}/${id}`;
  return { title: `${unit}.${chan}`, path };
}

function getTitleLinkObj(table, id, item) {
  if (table.indexOf('types') >= 0) return { title: item.title, path: getTypePath(id) };
  if (table.indexOf('scenes') >= 0) return { title: item.title, path: getScenescriptPath(item.id) };

  if (table.indexOf('device') >= 0) return getDeviceLinkObj(item.id);
  if (table.indexOf('global') >= 0) return getDeviceLinkObj(item.id);

  if (table.indexOf('template') >= 0) return { title: item.title, path: getTemplatePath(item.id) };
  if (table.indexOf('dialog') >= 0) return { title: item.title, path: getDialogPath(item.id) };
  if (table.indexOf('layout') >= 0) return { title: item.title, path: getLayoutPath(item.id) };
  if (table.indexOf('viscont') >= 0) return { title: item.title, path: getViscontPath(item.id) };
  if (table.indexOf('restapi') >= 0) return { title: item.title, path: getRestapiPath(item.id) };

  return { title: item.title, path: '' };
}

function getTypeLinkObj(table, id, item) {
  // Тип устройства
  // Название типа взято из справочника типов при подготовке данных
  if (table.indexOf('device') >= 0 && item.type) return { title: item['type#title'], path: getTypePath(item.type) };

  return { title: '', path: '' };
}

function getScenescriptPath(id) {
  // TODO - здесь нужно учесть мультисценарии!!
  return 'allscenes/scenes/scenescript/' + id + '/tabSceneCodeEditor';
}

function getTypePath(id) {
  return 'dev/types/typeview/' + id + '/tabTypeProps';
  // return 'resources/types/typeview/' + id + '/tabTypeProps';
}

function getTypeHandler(id, prop) {
  return 'dev/types/typeview/' + id + '/tabTypeHandlers/typeprophandler/'+ id +'.'+prop;
}

function getDialogPath(id) {
  return 'vis/dialog/dialogview/' + id + '/tabDialogEditor';
  // return 'resources/dialog/dialogview/' + id + '/tabDialogEditor';
}

function getTemplatePath(id) {
  return 'vis/vistemplate/vistemplateview/' + id + '/tabVistemplateEditor';
  // return 'resources/vistemplate/vistemplateview/' + id + '/tabVistemplateEditor';
}

function getLayoutPath(id) {
  return 'vis/layout/layoutview/' + id + '/tabLayoutEditor';
}
function getViscontPath(id) {
  return 'vis/viscont/viscontview/' + id + '/tabViscontEditor';
}

function getRestapiPath(id) {
  return 'datasource/restapihandlers/restapihandlerscript/' + id + '/tabRestapiCodeEditor';
}

/**
 * Возвращает массив свойств, которые могут быть привязаны (уже привязаны) к каналу
 *
 * @param {String} did - id устройства
 */
async function getDevicePropsForHardLink(did) {
  const doc = await dm.dbstore.findOne('devices', { _id: did });
  if (!doc || !doc.type) return [];

  const typeObj = typestore.getTypeObj(doc.type);
  if (!typeObj || !typeObj.props) return [];

  const result = [];
  // Сначала свойства - calc не берем. Это определяется типом

  Object.keys(typeObj.props).forEach(prop => {
    const propItem = typeObj.props[prop];
    if (!propItem.command && propItem.op != 'calc') {
      result.push(prop);
    }
  });
  return result;
}

async function qRecords(collection) {
  const data = await dm.dbstore.get(collection, {}, { fields: { _id: 1 } });
  return data.length;
}

async function qFilteredRecords(setname) {
  switch (setname) {
    case 'devhardtag':
      return countDevhardtag();

    default:
      return 0;
  }
}

async function countDevhardtag() {
  const data = await dm.dbstore.get(
    'devhard',
    {
      $where: function() {
        return !!(this.unit && this.chan && this.did && this.prop);
      }
    },
    { fields: { _id: 1, unit: 1, chan: 1, did: 1, prop: 1 } }
  );
  return data.length;
}

function isSysDevice(did) {
  return did.startsWith('__');
}

function isGlobal(did) {
  return did.startsWith('gl');
}

function getDevicePlacePath(did, holder) {
  const dobj = holder.devSet[did];
  if (!dobj || !dobj.parent) return '';

  let key = dobj.parent;
  const arr = [];
  while (key && key != 'place') {
    const item = liststore.getItemFromList('placeList', key);
    arr.unshift(item.title);
    key = item.parent;
  }
  return arr.join(' / ');
}

function getAllTypeCommands() {
  return typestore.getAllCmd();
}

function getAllTypeProps() {
  return typestore.getAllProp();
}

async function getUnitDoc(nodeid) {
  return dm.findRecordById('units', nodeid);
}

async function getAvailablePlugins(folder, collection) {
  let result = [];
  let unitDocs;
  try {
    // Считать папки в папке folder
    const pluginNames = fut.readFolderSync(folder, { dir: 1 });

    // TODO - проверить, что это плагин

    // Вернуть список доступных плагинов (есть в папке, нет в проекте)
    // unitDocs = await dm.dbstore.get('units');
    unitDocs = await dm.dbstore.get(collection);

    for (const name of pluginNames) {
      if (!unitExists(name)) result.push(name);
    }
  } catch (e) {
    console.log('ERROR: getAvailablePlugins ' + util.inspect(e));
  }
  return result;

  function unitExists(id) {
    for (const item of unitDocs) {
      if (item._id == id || item.parent == 'plugin_' + id) return true;
    }
  }
}

function getPluginManifestProp(plugin, prop) {
  if (!plugin) return null;
  const ppath = appconfig.getThePluginPath(plugin);
  const filename = `${ppath}/${plugin}.json`;
  if (!fs.existsSync(filename)) return null; // Нет манифеста

  const data = fut.readJsonFileSync(filename, true); // nothrow
  return data[prop] || '';
}

async function calcNewUnitId(plugin) {
  const unitDocs = await dm.dbstore.get('units');
  return hut.calcNewId(unitDocs, '_id', plugin);
}

module.exports = {
  getListItem,
  getRecordIdByLink,
  chooseTreeItemComponent,
  getDeviceTitle,
  getDeviceDn,
  getDevicePlacePath,

  getTreeItemTitle,
  formTitle,
  isRealtimeTable,
  getRealtimeValues,
  formSubTreeLeafItem,
  formLinkObj,
  formSmartbutton2Obj,
  getDeviceLinkObj,
  getChannelLinkObj,
  getDevicePropsForHardLink,
  getTypePath,
  getTypeHandler,
  getScenescriptPath,
  qRecords,
  qFilteredRecords,
  getDeviceDidByDn,
  getDeviceDbFormUrl,

  getAllTypeCommands,
  getAllTypeProps,
  getUnitDoc,
  getAvailablePlugins,
  getPluginManifestProp,
  calcNewUnitId,
  isGlobal
};
