/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
// const path = require('path');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
const plugininstall = require('./plugininstall');

function getExcludedProps() {
  return ['_id', 'name', 'title', 'order', 'parent', 'active', 'suspend'];
}

async function getUnitDocs(holder) {
  return (await holder.dm.dbstore.get('units')).filter(doc => isUnitDoc(doc));
}

function isUnitDoc(doc) {
  return doc && !doc.folder && doc.plugin;
}

function getDefaultPropsFromForm(filename) {
  try {
    const data = fut.readJsonFileSync(filename);
    appconfig.translateSys(data); // Чтобы выполнились подстановки типа ${project}
    if (!data.grid || !Array.isArray(data.grid)) throw { message: 'Invalid form. Exected "grid" aray!' };

    const res = {};
    const pArray = data.grid.map(gridItem => gridItem.id);
    pArray.forEach(p => {
      if (data[p] && Array.isArray(data[p])) {
        data[p].forEach(item => {
          if (item.prop && item.default != undefined) {
            res[item.prop] = item.default;
          }
        });
      }
    });
    return res;
  } catch (e) {
    console.log('ERROR: getDefaultPropsFromForm ' + filename + ': ' + hut.getShortErrStr(e));
    return {};
  }
}

async function install(packFolder, info, emitWatch) {
  if (!info) return;

  const pluginid = info.id;
  const folder = info.dbagent ? appconfig.getTheDbagentPath(pluginid) : appconfig.getThePluginPath(pluginid);

  let mes = info.dbagent ? info.description : 'Plugin ' + pluginid + '. ' + (info.description || '');
  mes += ' version ' + info.version;
  emitWatch(mes);

  try {
    fut.checkAndMakeFolder(folder);

    emitWatch('Copy to  ' + folder);
    await wu.cpP({ src: packFolder, dest: folder });
  } catch (e) {
    // Если установить не удалось - больше ничего не делаем
    console.log('ERROR: install ' + pluginid + util.inspect(e));
    throw e;
  }

  mes = await plugininstall.installShIfExists(pluginid);
  emitWatch(mes);
  try {
    await wu.installNodeModulesP(folder);
  } catch (e) {
    console.log('ERROR: Npm install error: ' + util.inspect(e));
    emitWatch('Npm install error: ' + hut.getShortErrStr(e));
  }
}

async function prepareUnitDocAfterInstall(pluginid, holder) {
  const manifest = await holder.dm.getCachedData({ method: 'getmeta', type: 'manifest', id: pluginid });
  const _id = getUnitDocId(pluginid, manifest.single);
  console.log('INFO: install ' + _id);

  const unitDoc = await holder.dm.findRecordById('units', _id);
  if (unitDoc) return; // Уже есть в таблице

  const doc = { _id, parent: 'unitgroup', order: 100 };
  if (!manifest.single) {
    doc.name = pluginid.toUpperCase();
    doc.folder = 1;
  } else {
    createNewUnitDoc(doc, pluginid);
  }
  return doc;
}

function getUnitDocId(pluginid, single) {
  return single ? pluginid : 'plugin_' + pluginid;
}

function createNewUnitDoc(doc, pluginid) {
  // Получить свойства-параметры и дефолтные значения для этого плагина из формы formPluginCommon
  const defObj = getDefaultPropsFromForm(appconfig.getV5FormPath(pluginid, 'formPluginCommon'));
  return { ...doc, plugin: pluginid, active: 1, suspend: 1, ...defObj };
}

function invalidateCache(pluginid, dm) {
  dm.invalidateCache({ method: 'getmeta', type: 'plugininfo', id: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'manifest', id: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'formPluginCommon', nodeid: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'formPluginChannelsTable', nodeid: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'channelview', nodeid: pluginid });
}

module.exports = {
  getExcludedProps,
  getUnitDocs,
  isUnitDoc,
  getDefaultPropsFromForm,
  install,
  createNewUnitDoc,
  prepareUnitDocAfterInstall,
  invalidateCache
};
