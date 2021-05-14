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
const nu = require('../utils/netutil');
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

    const res = updateutil.compareSemVer(version, info.version);
    // console.log('compareSemVer '+ version+' vs '+info.version +' RES='+res)

    return res ? folder: '';
  } catch (e) {
    console.log('WARN: Update system plugin ' + name + '. Reason: ' + hut.getShortErrStr(e));
  }
  return folder;
}

async function updatePlugin({ type, name, url }, dest) {
  let zipfile = updateutil.getFilenameForZip(name);
  let ct;
  let location;

  try {
    console.log('INFO: update plugin ' + url);
    ct = await nu.httpDownloadP(url, zipfile);
  } catch (e) {
    if (typeof e == 'string') {
      location = e.substr(9);
    } else {
      console.log('ERROR:  update plugin  ' + +hut.getShortErrStr(e));
      throw { message: 'Ошибка при закачке обновлений!' };
    }
  }

  try {
    if (location) {
      console.log('INFO: update => 302 location ' + location);
      ct = await nu.httpDownloadP(location, zipfile);
    }
    console.log('INFO: update => Content-type: ' + ct + '. Saved to file ' + zipfile);
    let tempdir = appconfig.getTmpFolder(name); // Временная папка для разархивирования

    // console.log('INFO: Upzip to ' + tempdir);
    const src = await updateutil.unzipAndDive(zipfile, tempdir);

    // Если папки dest нет - создать ее
    fut.checkAndMakeFolder(dest);
    await wu.cpP({ src, dest });
    // const backup = updateutil.getBackupFolder(name + '_v' + version);
    // await wu.rsyncP({ src, dest, backup, flags: ' -arc -v' });

    logNewVersion(type, name);

    // Удалить исходники
    fut.delFileSync(zipfile);
    // fut.delFolderSync(tempdir);
  
    fs.rmdirSync(tempdir, { recursive: true, force: true });
    
  } catch (e) {
    console.log('ERROR:  update ' + name + hut.getShortErrStr(e));
    throw { message: 'Ошибка при закачке обновлений ' + name };
  }
}

function logNewVersion(type, name) {
  // Вывести в лог версию из нового .ih файла
  try {
    const filename = appconfig.getIhFilePath(type, name);
    const info = fut.readJsonFileSync(filename);
    console.log('INFO: Updated '+name+'. Version: '+info.version);
  } catch (e) {
    console.log('WARN: After Update system plugins ' +name+'. '+ hut.getShortErrStr(e))
  }
}
