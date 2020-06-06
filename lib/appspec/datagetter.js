/**
 * datagetter.js
 *
 * Подготовка данных
 * на прикладном уровне
 *
 */

const dm = require('../datamanager');
// const descriptor = require('../descriptor');
// const hut = require('../utils/hut');

const liststore = require('../dbs/liststore');
const typestore = require('../device/typestore');

// const handlerutils = require('../device/handlerutils');

const emObj = { '0': '❏', '1': '✔︎', '2': '✘' };

async function getRecordIdByLink(formId, nodeid) {
  if (formId.startsWith('channellink')) {
    // nodeid = d0800.value - найти id записи в таблице devhard
    const [did, prop] = nodeid.split('.');
    const hdoc = await dm.dbstore.findOne('devhard', { did, prop });
    if (!hdoc) throw { err: 'SOFTERR', message: 'Not found channellink record in "devhard" for nodeid:' + nodeid };
    return hdoc._id;
  }
  return nodeid;
}

function chooseTreeItemComponent(item, desc) {
  if (desc.table == 'units') {
    // Найти в списке
    const listItem = liststore.getItemFromList('unitList', item.id);
    // Здесь нужно расширить логику!!
    return listItem.id == listItem.plugin ? 'pluginview1Tab' : 'pluginview';
  }
}

function getTreeItemTitle(table, item, olditem) {
  let title = item && item.name ? item.name : olditem && olditem.name ? olditem.name : '';
  if (table == 'device') {
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

function isCustomSubtree(tree) {
  return ['devicepropswithlinks', 'channels'].includes(tree);
}

function getCustomSubtree() {

}

function formSubTreeLeafItem(doc, id, nodeid) {
  const item = { id: doc._id, title: doc.title || doc.name, parent: doc.parent || 0, order: doc.order };
  if (id == 'channels' && nodeid) {
    item.title = doc.chan;
    item.component = 'channelview.' + nodeid;
  }
  return item;
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
  isCustomSubtree,
  getCustomSubtree,
  formSubTreeLeafItem
};
