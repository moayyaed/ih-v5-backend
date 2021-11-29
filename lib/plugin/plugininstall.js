/**
 * 
 * plugininstall.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');

const pluginutil = require('./pluginutil');

/**
 * installPlugin
 * - читает файл .ih - первый найденный (должен быть один)
 * - устанавливает в папку plugins
 * - cбрасывает кэш метаданных - формы, файл .ih
 *
 *  Если модуль уже есть - файлы перезаписываются (но не удаляются)
 *  @throw -  если нет файла .ih или ошибка при установке
 */
async function installPlugin(packFolder, emitWatch, holder) {
  // Плагин - читаем его .ih  файл
  const pluginInfo = appconfig.getPluginInfo(packFolder);
  if (!pluginInfo || !pluginInfo.id) throw { message: 'File .ih missing or invalid!' };

  const pstr = appconfig.getMessage('PLUGIN') + ' ' + pluginInfo.id;
  // const err_only5 = 'Система работает только с плагинами версии 5.'; needPluginV5
  const err_only5 = appconfig.getMessage('needPluginV5');

  // if (!pluginInfo.version) throw { message: pstr + '. Отсутствует информация о версии плагина! ' + err_only5 };
  if (!pluginInfo.version) throw { message: pstr + appconfig.getMessage('misPluginVersion') + ' ' + err_only5 };
  if (!pluginInfo.version.startsWith('5.')) throw { message: pstr + ' v' + pluginInfo.version + '. ' + err_only5 };

  const pluginid = pluginInfo.id;
  await doInstall(packFolder, pluginInfo, tmes => emitWatch(tmes));
  pluginutil.invalidateCache(pluginid, holder.dm);

  // Если плагина нет - добавить папку или одиночный плагин
  return prepareUnitDocAfterInstall(pluginInfo, holder);
}


async function prepareUnitDocAfterInstall({ id, version }, holder) {
  // const manifest = await holder.dm.getCachedData({ method: 'getmeta', type: 'manifest', id });
  const single = appconfig.getPluginManifestProp(id, 'single');
  const _id = getUnitDocId(id, single);
  console.log('INFO: install ' + _id);

  const unitDoc = await holder.dm.findRecordById('units', _id);

  if (unitDoc) {
    // Уже есть в таблице - обновить системные индикаторы
    refreshIndicatorsVersion();
    return;
  }

  let doc = { _id, parent: 'unitgroup', order: 100 };
  if (!single) {
    doc.name = id.toUpperCase();
    doc.folder = 1;
  } else {
    // {"_id":"cctv","order":4600,"parent":"unitgroup","id":"cctv","plugin":"cctv","active":1,"suspend":1,"wsport":"8099"}
    doc.id = id;
    doc = pluginutil.createNewUnitDoc(doc, id);
  }
  return doc;

  function refreshIndicatorsVersion() {
    // Уже есть в таблице - обновить системные индикаторы
    const devs = Object.keys(holder.unitSet)
      .filter(unit => unit == id || holder.unitSet[unit].plugin == id)
      .map(unit => holder.unitSet[unit].dn);

    if (devs.length) {
      const res = {};
      devs.forEach(dn => {
        res[dn] = { version };
      });
      holder.emit('received:device:data', res);
    }
  }
}

function getUnitDocId(pluginid, single) {
  return single ? pluginid : 'plugin_' + pluginid;
}

async function installShIfExists(pluginid) {
  const ppath = appconfig.getThePluginPath(pluginid);
  return fs.existsSync(`${ppath}/install.sh`) ? execInstallSh(ppath) : '';
}

async function execInstallSh(ppath) {
  const installFile = `${ppath}/install.sh`;
  let result = 'Try exec install.sh \n';
  console.log('INFO: exec '+installFile)
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


async function doInstall(packFolder, info, emitWatch) {
  if (!info) return;

  const pluginid = info.id;
  const folder = info.dbagent ? appconfig.getTheDbagentPath(pluginid) : appconfig.getThePluginPath(pluginid);

  let mes = info.dbagent ? info.description : 'Plugin ' + pluginid + '. ' + (info.description || '');
  mes += ' version ' + info.version;
  emitWatch(mes);

  try {
    fut.checkAndMakeFolder(folder);

    await wu.cpP({ src: packFolder, dest: folder });
  } catch (e) {
    // Если установить не удалось - больше ничего не делаем
    console.log('ERROR: install ' + pluginid + util.inspect(e));
    throw e;
  }

  mes = await installShIfExists(pluginid);
  if (mes) emitWatch(mes);
  try {
    mes = await wu.installNodeModulesP(folder);
    if (mes) emitWatch('Npm install: ' + mes);
  } catch (e) {
    console.log('ERROR: Npm install error: ' + util.inspect(e));
    emitWatch('Npm install error: ' + hut.getShortErrStr(e));
  }
}



module.exports = {
  doInstall,
  installPlugin
};