/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const path = require('path');

// const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
const plugininstall = require('./plugininstall');

function isUnitDoc(doc) {
  return doc && !doc.folder && doc.plugin;
}

async function installPlugin(packFolder, pluginInfo, emitWatch) {
  if (!pluginInfo) return;

  const pluginid = pluginInfo.id;
  let mes = 'Plugin ' + pluginid + '. ' + (pluginInfo.description || '') + ' version ' + pluginInfo.version;
  emitWatch(mes);
  try {
    const folder = appconfig.getThePluginPath(pluginid);
    fut.checkAndMakeFolder(folder);

    emitWatch('Copy to  ' + folder);
    await wu.cpP({ src: packFolder, dest: folder });
  } catch (e) {
    // Если установить не удалось - больше ничего не делаем
    console.log('ERROR: install plugin ' + util.inspect(e));
    throw e;
  }
  
  mes = await plugininstall.installShIfExists(pluginid);
  emitWatch(mes);
  mes = await plugininstall.installNpmIfNeed(pluginid);
  emitWatch(mes);
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
    doc.plugin = pluginid;
  }
  return doc;
}

function getUnitDocId(pluginid, single) {
  return single ? pluginid : 'plugin_' + pluginid;
}

function invalidatePluginMetadataCache(pluginid, holder) {
  // Сбросить кэш метаданных плагина
  holder.dm.invalidateCache({ type: 'plugininfo', id: pluginid });
  holder.dm.invalidateCache({ type: 'manifest', id: pluginid });

  // И форм плагина для всех экземпляров!!
  holder.dm.invalidateCache({ type: 'form', id: 'formPluginCommon', nodeid: pluginid });
  holder.dm.invalidateCache({ type: 'form', id: 'formPluginChannelsTable', nodeid: pluginid });
  holder.dm.invalidateCache({ type: 'form', id: 'channelview', nodeid: pluginid });
}

module.exports = {
  isUnitDoc,
  installPlugin,
  invalidatePluginMetadataCache,
  prepareUnitDocAfterInstall
};
