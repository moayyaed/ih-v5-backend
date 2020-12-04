/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const fs = require('fs');
// const child = require('child_process');
// const path = require('path');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

async function getUnitDoc(nodeid) {
return dm.findRecordById('units', nodeid);
}
async function installShIfExists(pluginid) {
  const ppath = appconfig.getThePluginPath(pluginid);
  return fs.existsSync(`${ppath}/install.sh`) ? execInstallSh(ppath) : '';
}

async function execInstallSh(ppath) {
  const installFile = `${ppath}/install.sh`;
  let result = 'Try exec install.sh \n';
  try {
    fut.checkFileAndChangeModeSync(installFile, 0o777);
    result += await wu.tryRunCmdP('sudo ./install.sh', { cwd: ppath });
    result += '\n';
    // await - удалить install.sh
    await fs.promises.unlink(installFile);
  } catch (err) {
    result += err.message; // Если ошибка произошла при удалении
  }
  return result;
}

async function installNpmIfNeed() {}


async function getAvailablePlugins(folder, collection) {
  let result = [];
  let unitDocs;
  try {
    // Считать папки в папке plugins
    // const folder = appconfig.get('pluginspath');
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

async function getAvailableDbagents() {
  return getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
 /*
  let result = [];
  try {
    // Считать папки в папке plugins
    const folder = appconfig.get('agentspath');
    console.log('getAvailableDbagents folder=' + folder);
    const pluginNames = fut.readFolderSync(folder, { dir: 1 });

    console.log('getAvailableDbagents pluginNames=' + util.inspect(pluginNames));
    // TODO - проверить, что это dbagent

    // Вернуть список доступных (есть в папке, нет в проекте)
    const docs = await dm.dbstore.get('dbagents', {});
  

    for (const name of pluginNames) {
      if (!unitExists(name, docs)) result.push(name);
    }
  } catch (e) {
    console.log('ERROR: getAvailablePlugins ' + util.inspect(e));
  }
 

  return result;

  function unitExists(id, docs) {
    for (const item of docs) {
      if (item._id == id) return true;
    }
  }
   */
}


async function calcNewUnitId(plugin) {
  // if (plugin.single) return plugin.id;
  const unitDocs = await dm.dbstore.get('units');
  return hut.calcNewId(unitDocs, '_id', plugin);
}

module.exports = {
  getUnitDoc,
  getAvailablePlugins,
  getAvailableDbagents,
  calcNewUnitId,
  installShIfExists,
  installNpmIfNeed
};
