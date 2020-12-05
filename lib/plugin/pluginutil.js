/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const fs = require('fs');

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
  const ppath = appconfig.getThePluginPath(plugin);
  const filename = `${ppath}/${plugin}.json`;
  if (!fs.existsSync(filename)) return null; // Нет манифеста

  const data = fut.readJsonFileSync(filename, true); // nothrow
  return data[prop] || '';
}

async function calcNewUnitId(plugin) {
  // if (plugin.single) return plugin.id;
  const unitDocs = await dm.dbstore.get('units');
  return hut.calcNewId(unitDocs, '_id', plugin);
}

module.exports = {
  getUnitDoc,
  getAvailablePlugins,
  getPluginManifestProp,
  getPluginManifestProp,
  calcNewUnitId,
  installShIfExists,
  installNpmIfNeed
};
