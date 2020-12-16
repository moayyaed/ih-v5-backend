/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

// const util = require('util');
// const fs = require('fs');

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
  let mes = 'Plugin ' + pluginid + '. ' + (pluginInfo.decription || '') + ' version:' + pluginInfo.version;
  emitWatch(mes);

  const folder = appconfig.getThePluginPath(pluginid);
  fut.checkAndMakeFolder(folder);

  emitWatch('Copy to  ' + folder);
  await wu.cpP({ src: packFolder, dest: folder });

  mes = await plugininstall.installShIfExists(pluginid);
  emitWatch(mes);
  mes = await plugininstall.installNpmIfNeed(pluginid);
  emitWatch(mes);
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
  invalidatePluginMetadataCache
};
