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
const typestore = require('../device/typestore');
const tagstore = require('../dbs/tagstore');
const defaultalerts = require('../device/defaultalerts');
const deviceutil = require('../device/deviceutil');
const handlerutil = require('../device/handlerutil');
const devicelogger = require('../device/devicelogger');

const emObj = { '0': '❏', '1': '✔︎', '2': '✘' };

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
        res.push({ id: item.id, title: formTitle(listname, item) });
      }
    });
  }
  return { data: res };
}

function getDroplistItemFromList(listname, key) {
  const item = listname == 'taglist' ? tagstore.getDroplistItem(key) : liststore.getItemFromList(listname, key);

  return item ? { id: item.id, title: formTitle(listname, item) } : { id: '-', title: '-' };
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
  return item ? formTitle('sceneList', item) : id + ': Scene not found';
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

function getDeviceScenePropTitle(sceneId, dn, prop, holder) {
  if (!dn || !prop || !sceneId) return '';
  return holder.sceneExtprops[sceneId] && holder.sceneExtprops[sceneId][dn] && holder.sceneExtprops[sceneId][dn][prop]
    ? holder.sceneExtprops[sceneId][dn][prop].note || prop
    : prop;
}

function getDeviceLinkObj(did, prop) {
  return { title: getDeviceTitle(did, prop), path: getDeviceFormUrl(did) };
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

function isSysDevice(did) {
  return did.startsWith('__');
}

function isGlobal(did) {
  return did && did.startsWith('gl');
}

function getDeviceKind(did) {
  if (isSysDevice(did)) return 'sys';
  if (isGlobal(did)) return 'gl';
  return 'device';
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
  if (table.indexOf('type') >= 0) return { title: item.title, path: getTypePath(id) };
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
  return 'allscenes/scenes/scenescript/' + id + '/tabSceneCodeEditor';
}

function getScenecommonPath(id) {
  return 'allscenes/scenes/scenescript/' + id + '/tabSceneCommon';
}

function getSchedrulePath(id) {
  return 'allscenes/schedrules/schedrule/' + id + '/tabSchedruleCommon';
}

function getTypePath(id) {
  return 'dev/types/typeview/' + id + '/tabTypeProps';
  // return 'resources/types/typeview/' + id + '/tabTypeProps';
}

function getTypeHandlerPath(id, prop) {
  return 'dev/types/typeview/' + id + '/tabTypeHandlers/typeprophandler/' + id + '.' + prop;
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

function getAllTypeCommands() {
  return typestore.getAllCmd();
}

function getAllTypeProps() {
  return typestore.getAllProp();
}

function getDeviceDn(did) {
  const listname = isGlobal(did) ? 'globalList' : 'deviceList';
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

async function getInnerLog(did, holder, reverse) {
  return devicelogger.getLog(did, reverse);
}

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
  const scenePath = getScenecommonPath(sceneId);
  return sceneListItem && sceneListItem.name
    ? { title: sceneListItem.name, path: scenePath }
    : { title: '-', path: '' };
}

function getSceneStateStr(active, blk) {
  const state = blk ? 2 : active ? 1 : 0;
  return blk ? 'Blocked' : liststore.getTitleFromList('sceneStateList', state);
}

function getWhenStr(rec, op, prop) {
  if (prop.startsWith('_format')) {
    // При выводе значения "value" в виде строки
    return getMes('When_OutputValue')+' "' + prop.substr(8) + '" '+ getMes('asString');
  }
  if (prop.startsWith('_On')) {
    if (prop == '_OnChange') {
      let str = rec.par_OnChange
        ? rec.par_OnChange != '*'
          ? 'свойств ' + rec.par_OnChange
          : ' любого свойства устройства'
        : '';

      if (rec.par2_OnChange && rec.par2_OnChange != '-') {
        const item = liststore.getItemFromList('globalList', rec.par2_OnChange);
        const glDn = item && item.dn ? item.dn : rec.par2_OnChange + '(имя не определено?)';
        if (str) str += ', ';
        str += ' глобальной переменной ' + glDn;
      }
      if (!str) str = getMes('ConditionNotSET!');
      return 'При изменении ' + str;
    }

    if (prop == '_OnInterval')
      return 'Циклически каждые ' + (rec.par_OnInterval != undefined ? rec.par_OnInterval : 600) + getMes('_sec');

    if (prop == '_OnSchedule') return getMes('When_Schedule')+': ' + rec.par_OnSchedule;

    if (prop == '_OnBoot') return getMes('When_SystemStarting');
  }

  switch (op) {
    case 'calc':
      // При изменении свойств устройства для вычисления "status"
      return getMes('When_ChangeDevPropsForCalc') +' "' + prop + '"';
    case 'cmd':
      //  'При вызове команды "toggle"
      return getMes('When_CommandCall')+' "' + prop + '"';
    default:
      // 'При поступлении данных для приема значения "state"
      return getMes('When_IncomingData')+' "' + prop + '"';
  }
}

function getMes(id) {
  return appconfig.getMessage(id);
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
  getDeviceDbFormUrl,
  getTypeHandlerPath,
  getDeviceDn,
  getDevicePlacePath,
  getDroplistItemFromList,
  getDevicePropsForHardLink,
  getTypePath,
  getTypeobj,
  getChannelLinkObj,
  isGlobal,
  isSysDevice,
  getScenescriptPath,
  getScenecommonPath,
  getSchedrulePath,
  getJLevelsRecord,
  getInnerLog,
  splitHandlerFilename,
  getDefaultalerts,
  getDeviceFormUrl,
  getP2pKey,

  isSuitableAlerts,
  getLocalVarsObject,
  getLocalDefval,
  getListAsArray,
  getSceneStateStr,
  getSceneStr,
  getWhenStr
};
