/**
 * domaindata.js
 *
 * Функции подготовки данных
 * на прикладном уровне
 */

// const util = require('util');
const appconfig = require('../appconfig');

const hut = require('../utils/hut');

const liststore = require('../dbs/liststore');
const tagstore = require('../dbs/tagstore');

const typestore = require('../device/typestore');
const defaultalerts = require('../device/defaultalerts');
const deviceutil = require('../device/deviceutil');
const handlerutil = require('../device/handlerutil');
const misc = require('./misc');



function getListItem(listname, id) {
  return liststore.getItemFromList(listname, id);
}

function getDefaultalerts(vtype) {
  return defaultalerts(vtype);
}

function isSuitableAlerts(vtype, alertsObj) {
  switch (vtype) {
    case 'N':
      return alertsObj.Norm && alertsObj.LoLo && alertsObj.Lo && alertsObj.Hi && alertsObj.HiHi;

    default:
      return alertsObj.Norm && alertsObj.Alert;
  }
}

/**
 * Возвращает список (droplist)
 * @param {String} id идентификатор (имя) списка
 *
 * Списки кэшируются в liststore
 * Описание списков (desc) находится в файле lists.json, который загружен в descriptor
 */
function getDroplist(listname, noEmpty) {
  const res = noEmpty ? [] : [{ id: '-', title: '' }];
  if (listname == 'taglist') return { data: tagstore.getDroplist() };

  if (listname == 'deviceListAndAny') {
    listname = 'deviceList';
    res.push({ id: '__device', title: appconfig.getMessage('AnyDevice') });
  }

  if (liststore.hasList(listname)) {
    liststore.getListAsArray(listname).forEach(item => {
      if (!item.folder) {
        res.push({ id: item.id, title: misc.formTitle(listname, item) });
      }
    });
  }
  return { data: res };
}

function getDroplistItemFromList(listname, key) {
  const item = listname == 'taglist' ? tagstore.getDroplistItem(key) : liststore.getItemFromList(listname, key);

  return item ? { id: item.id, title: misc.formTitle(listname, item) } : { id: '-', title: '-' };
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
    if (item.title || (olditem && olditem.title)) {
      title = item.title;
    } else if (item.name || (olditem && olditem.name)) {
      title = item.name || item.chan;
    } else {
      title = item.chan || (olditem && olditem.chan) || '';
    }
  } else if (table == 'project') {
    title = getProjectTitle(item._id || olditem._id);
  } else if (table == 'dbagent') {
    title = getDbagentTitle(item._id || olditem._id);
  }
  if (!title) title = item.title || (olditem && olditem.title);

  return title;
}

function getSceneTitle(id) {
  const item = liststore.getItemFromList('sceneList', id);
  return item ? misc.formTitle('sceneList', item) : id + ': Scene not found';
}

function getSnippetTitle(id) {
  const item = liststore.getItemFromList('snippetList', id);
  return item ? item.name : id + ': Snippet not found';
}

function getSnippetLinkObj(id) {
  return { title: getSnippetTitle(id), path: 'datasource/snippets/snippetscript/' + id + '/tabSnippetCodeEditor' };
}

function getProjectTitle(id) {
  const item = liststore.getItemFromList('projectList', id);
  return misc.formTitle('projectList', item);
}

function getDbagentTitle(id) {
  const item = liststore.getItemFromList('dbagentList', id);
  return misc.formTitle('dbagentList', item);
}

function getDeviceTitle(did, prop) {
  const listname = misc.isGlobal(did) ? 'globalList' : 'deviceList';
  const item = liststore.getItemFromList(listname, did);
  return !item || !item.dn ? did + ': Not found ' : misc.formTitle(listname, item) + (prop ? ' ▪︎ ' + prop : '');
}

function getDeviceScenePropTitle(sceneId, dn, prop, holder) {
  if (!dn || !prop || !sceneId) return '';
  return holder.sceneExtprops[sceneId] && holder.sceneExtprops[sceneId][dn] && holder.sceneExtprops[sceneId][dn][prop]
    ? holder.sceneExtprops[sceneId][dn][prop].note || prop
    : prop;
}

function getDeviceLinkObj(did, prop) {
  return { title: getDeviceTitle(did, prop), path: misc.getFormUrl('Device', did) };
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

function getChannelLinkObj(id, unit, chan) {
  const path = `datasource/plugins/pluginview/${unit}/tabUnitChannels/channelview.${unit}/${id}`;
  return { title: `${unit}.${chan}`, path };
}

function getTitleLinkObj(table, id, item) {
  if (table.indexOf('type') >= 0) return { title: item.title, path: misc.getFormUrl('TypeProps', id) };
  if (table.indexOf('scenes') >= 0) return { title: item.title, path: misc.getFormUrl('SceneCodeEditor', item.id) };

  if (table.indexOf('device') >= 0) return getDeviceLinkObj(item.id);
  if (table.indexOf('global') >= 0) return getDeviceLinkObj(item.id);

  if (table.indexOf('template') >= 0) return { title: item.title, path: misc.getFormUrl('VistemplateEditor', item.id) };
  if (table.indexOf('dialog') >= 0) return { title: item.title, path: misc.getFormUrl('DialogEditor', item.id) };
  if (table.indexOf('layout') >= 0) return { title: item.title, path: misc.getFormUrl('LayoutEditor', item.id) };
  if (table.indexOf('viscont') >= 0) return { title: item.title, path: misc.getFormUrl('ViscontEditor', item.id) };
  if (table.indexOf('restapi') >= 0) return { title: item.title, path: misc.getFormUrl('RestapiCodeEditor', item.id) };

  return { title: item.title, path: '' };
}

function getTypeLinkObj(table, id, item) {
  // Тип устройства
  // Название типа взято из справочника типов при подготовке данных
  if (table.indexOf('device') >= 0 && item.type)
    return { title: item['type#title'], path: misc.getFormUrl('TypeProps', item.type) };

  return { title: '', path: '' };
}

function getAllTypeCommands() {
  return typestore.getAllCmd();
}

function getAllTypeProps() {
  return typestore.getAllProp();
}

function getDeviceDn(did) {
  const listname = misc.isGlobal(did) ? 'globalList' : 'deviceList';
  const item = liststore.getItemFromList(listname, did);
  return !item || !item.dn ? did + ': Not found ' : item.dn;
}

function getDevicePlacePath(did, holder) {
  return deviceutil.getDevicePlacePath(did, holder);
}

function getTypeobj(type) {
  return typestore.getTypeObj(type);
}

/**
 * Возвращает массив свойств, которые могут быть привязаны (уже привязаны) к каналу
 *
 * @param {String} did - id устройства
 */
async function getDevicePropsForHardLink(did, dm) {
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

function getJLevelsRecord(nodeid) {
  const arr = getDroplist('messageLevelList', true).data;
  const defFontColor = 'rgba(0,0,0,1)';

  const props = {};
  arr.forEach(item => {
    const { id, ...levobj } = item;
    props['lev_' + id] = { level: id, ...levobj, fontcolor: defFontColor };
  });
  return { _id: nodeid, props };
}

/*
async function getInnerLog(did, holder, reverse) {
  return devicelogger.getLog(did, reverse);
}
*/

function splitHandlerFilename(str) {
  return handlerutil.splitHandlerFilename(str);
}

function getLocalVarsObject() {
  const resObj = {};
  const arr = liststore.getListAsArray('localList');
  arr
    .filter(item => !item.folder)
    .forEach(item => {
      resObj[item.dn] = hut.getNumberOrStr(item.defval);
    });
  return resObj;
}

function getSceneStr(id, holder) {
  // TODO holder - чтобы выводить конкретный экземпляр
  const sceneId = id ? id.split('#').shift() : '';

  const title = getSceneTitle(sceneId);
  return title || sceneId || id;
}

function getLocalDefval(did) {
  const item = getListItem('localList', did);
  return item ? hut.getNumberOrStr(item.defval) : 0;
}

function getListAsArray(listname) {
  return liststore.getListAsArray(listname);
}

function getP2pKey(holder) {
  const dn = '__UNIT_p2p';
  return holder.devSet[dn] && holder.devSet[dn].key ? holder.devSet[dn].key : '';
}

function getSceneLinkObj(id) {
  const sceneId = id ? id.split('#').shift() : '';
  if (!sceneId) return { title: '-', path: '' };

  const sceneListItem = liststore.getItemFromList('sceneList', sceneId);
  const scenePath = misc.getFormUrl('SceneCommon', sceneId);
  return sceneListItem && sceneListItem.name
    ? { title: sceneListItem.name, path: scenePath }
    : { title: '-', path: '' };
}

function getSceneStateStr(active, blk) {
  const state = blk ? 2 : active ? 1 : 0;
  return blk ? 'Blocked' : liststore.getTitleFromList('sceneStateList', state);
}

module.exports = {
  getListItem,
  getDroplist,
  getDeviceLinkObj,
  getSceneLinkObj,
  getSnippetLinkObj,
  getTreeItemTitle,
  formLinkObj,
  getAllTypeCommands,
  getAllTypeProps,
  getDeviceTitle,
  getDeviceScenePropTitle,

  getDeviceDn,
  getDevicePlacePath,
  getDroplistItemFromList,
  getDevicePropsForHardLink,

  getTypeobj,
  getChannelLinkObj,

  getJLevelsRecord,
  splitHandlerFilename,
  getDefaultalerts,

  getP2pKey,
  isSuitableAlerts,
  getLocalVarsObject,
  getLocalDefval,
  getListAsArray,
  getSceneStateStr,
  getSceneStr
};
