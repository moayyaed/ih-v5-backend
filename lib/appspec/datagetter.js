/**
 * datagetter.js
 *
 * Функции подготовки данных
 * на прикладном уровне
 *
 */

const util = require('util');
const dm = require('../datamanager');

const liststore = require('../dbs/liststore');
const typestore = require('../device/typestore');

// const handlerutils = require('../device/handlerutils');

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
  return nodeid;
}

function chooseTreeItemComponent(item, desc) {
  if (desc.table == 'units') {
    // Найти в списке
    const listItem = liststore.getItemFromList('unitList', item.id);
    // Здесь нужно расширить логику!!
    // return listItem.id == listItem.plugin ? 'pluginview1Tab' : 'pluginview';

    return listItem.id == listItem.plugin
      ? 'pluginview1Tab'
      : listItem.plugin.startsWith('mqtt')
      ? 'pluginviewPubSub'
      : 'pluginview';
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
  }
  return title;
}

function getDeviceTitle(did) {
  const item = liststore.getItemFromList('deviceList', did);
  return !item || !item.dn ? did + ': Device not found' : formTitle('deviceList', item);
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
      emo = emObj[item.status] || emObj['0'];
      return emo + ' ' + item.name;

    case 'unitList':
      return item.id;
    default:
      return item.title || item.name;
  }
}

function showHandlersForType(id) {
  return typestore.showHandlers(id);
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
  if (!unitItem || !unitItem.charr || !unitItem.channels) return {};
  const robj = {};

  unitItem.charr.forEach(item => {
    robj[item.chan] = {
      realtime_chan_value: '',
      realtime_chan_ts: '',
      realtime_dev_value: '',
      realtime_dev_ts: '',
      realtime_dev_err: '',
      realtime_dev_cts: ''
    };

    if (unitItem.channels[item.chan]) {
      robj[item.chan].realtime_chan_val = unitItem.channels[item.chan].val;
      robj[item.chan].realtime_chan_ts = unitItem.channels[item.chan].ts;
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

function getDevicecommonTableRtObject(devItem, holder) {
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
      return { title: getDeviceTitle(val), path: 'dev/devices/deviceview/' + val + '/tabDeviceCommon' };
    case 'chan':
      return getChannelLinkObj(item._id, item.unit, item.chan);
    // path = `datasource/plugins/pluginview/${item.unit}/tabUnitChannels/channelview.${item.unit}/${item._id}`;
    // return { title: `${item.unit}.${item.chan}`, path };
    default:
      return { title: val, path };
  }
  // return {title:val, path:'dev/devices/deviceview/'+val+'/tabDeviceCommon'}
}

function getDeviceLinkObj(did) {
  return { title: getDeviceTitle(did), path: 'dev/devices/deviceview/' + did + '/tabDeviceCommon' };
}

function getChannelLinkObj(id, unit, chan) {
  const path = `datasource/plugins/pluginview/${unit}/tabUnitChannels/channelview.${unit}/${id}`;
  return { title: `${unit}.${chan}`, path };
}

function getTitleLinkObj(table, id, item) {
  if (table.indexOf('types') >= 0) return { title: item.title, path: getTypePath(id) };
  if (table.indexOf('scenes') >= 0)
    return { title: item.title, path: 'scenes/scenes/scenescript/' + id + '/tabSceneScript' };

  if (table.indexOf('device') >= 0) return getDeviceLinkObj(item.id);
  return { title: item.title, path: '' };
}

function getTypeLinkObj(table, id, item) {
  // Тип устройства
  // Название типа взято из справочника типов при подготовке данных
  if (table.indexOf('device') >= 0 && item.type) return { title: item['type#title'], path: getTypePath(item.type) };

  return { title: '', path: '' };
}

function getTypePath(typeId) {
  return 'resources/types/typeview/' + typeId + '/tabTypeProps';
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

  // Команды - берем только direct? Это определяется в устройстве
  // НЕТ, берем все команды
  /*
  typeObj.commands.forEach(command => {
    // if (doc.props[command] && doc.props[command].dir) {
    if (doc.props[command]) {
      result.push(command);
    }
  });
  */

  return result;
}

async function qRecords(collection) {
  const data = await dm.dbstore.get(collection, {}, { fields: { _id: 1 } });
  return data.length;
}

function getTypePropsWithFname(fname) {
  const result = [];
  const typeMap = typestore.getTypeMap();
  for (const [typeId, typeItem] of typeMap) {
    Object.keys(typeItem.props).forEach(prop => {
      if (typeItem.props[prop].fname == fname) {
        result.push({ typeId, prop, fname });
      }
    });
  }
  return result;
}

module.exports = {
  getRecordIdByLink,
  chooseTreeItemComponent,
  getDeviceTitle,
  getTreeItemTitle,
  showHandlersForType,
  formTitle,
  isRealtimeTable,
  getRealtimeValues,
  formSubTreeLeafItem,
  formLinkObj,
  getDeviceLinkObj,
  getChannelLinkObj,
  getDevicePropsForHardLink,
  getTypePropsWithFname,
  getTypePath,
  qRecords
};
