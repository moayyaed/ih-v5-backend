/**
 * updateSystemPlugins.js
 *
 * Обновление системных плагинов
 * Информация о системных плагинах - upgrade/sysemplugins.json
 *
 */

// const util = require('util');
const path = require('path');
const fs = require('fs');

const updateutil = require('./updateutil');
const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
// const nu = require('../utils/netutil');
const fut = require('../utils/fileutil');

module.exports = async function() {
  const filename = `${appconfig.get('appdir')}/upgrade/systemplugins.json`;
  let systemPlugins;
  try {
    systemPlugins = fut.readJsonFileSync(filename);
    if (!Array.isArray(systemPlugins)) throw { message: 'Expected array: ' + filename };
  } catch (e) {
    console.log('ERROR: ' + hut.getShortErrStr(e) + ' System plugins updating was skipped..');
    return;
  }

  for (const item of systemPlugins) {
    try {
      if (!item.name || !item.url || !item.version) throw { message: 'Expected props "name", "url", "version"' };
      const dest = getPathToUpdate(item);
      if (dest) await updatePlugin(item, dest);
    } catch (e) {
      console.log('ERROR: Update System Plugin "' + item.name + '".  ' + hut.getShortErrStr(e));
    }
  }
};

/**
 * Проверяет, нужна ли закачка обновления
 * Если да - возвращает путь для установки обновлений
 * @param {Object} item
 * @return {String} folder
 *
 * Проверка выполняет чтение файла .ih
 *  НУЖНО УСТАНОВИТЬ, если
 *   - файл отсутствует (все системные плагины ДОЛЖНЫ иметь .ih)
 *   - файл есть, произошла ошибка при чтении файла ih (???)
 *   - version в файле < заданного на входе
 *  НЕ УСТАНАВЛИВАЕТСЯ, если
 *   - в файле .ih нет поля version
 *   - version в файле >= заданного на входе
 */
function getPathToUpdate({ type, name, version }) {
  const filename = appconfig.getIhFilePath(type, name);
  if (!filename) {
    console.log('ERROR: Empty result appconfig.getIhFilePath for type=' + type + ' name=' + name);
    return;
  }

  const folder = path.dirname(filename);
  try {
    const info = fut.readJsonFileSync(filename);
    if (!info.version) return; // Нет версионности - ничего не делаем

    const res = hut.compareSemVer(version, info.version);
    return res ? folder : '';
  } catch (e) {
    console.log('WARN: Not updated system plugin ' + name + '. Reason: ' + hut.getShortErrStr(e));
  }
  return folder;
}

async function updatePlugin({ type, name, url }, dest) {
  try {
    const src = await updateutil.downloadAndUnzip(name, url);
    fut.checkAndMakeFolder(dest);
    await wu.cpP({ src, dest });
    logNewVersion(type, name);
    fs.rmdirSync(src, { recursive: true, force: true });
  } catch (e) {
    console.log('ERROR:  updatePlugin ' + name + hut.getShortErrStr(e));
    throw { message: appconfig.getMessage('DownloadError') };
  }
}

function logNewVersion(type, name) {
  // Вывести в лог версию из нового .ih файла
  try {
    const filename = appconfig.getIhFilePath(type, name);
    const info = fut.readJsonFileSync(filename);
    console.log('INFO: Updated ' + name + '. Version: ' + info.version);
  } catch (e) {
    console.log('WARN: After Update system plugins ' + name + '. ' + hut.getShortErrStr(e));
  }
}
