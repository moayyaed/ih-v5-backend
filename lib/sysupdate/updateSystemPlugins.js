/**
 * updateSystemPlugins.js
 *
 * Обновление системных плагинов
 * Информация о системных плагинах - upgrade/sysemplugins.json
 *
 */

const util = require('util');
const path = require('path');

const updateutil = require('./updateutil');
const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const nu = require('../utils/netutil');
const fut = require('../utils/fileutil');

module.exports = async function() {
  const filename = `${appconfig.get('appdir')}/upgrade/sysemplugins.json`;
  let systemPlugins;
  try {
    systemPlugins = fut.readJsonFileSync(filename);
    if (!Array.isArray(systemPlugins)) throw { message: 'Expected array: ' + filename };
  } catch (e) {
    console.log('ERROR: ' + hut.getShortErrStr(e) + ' System plugins updating was skipped..');
    return;
  }

  /*
  systemPlugins = [
    { name: 'sqlite', 
     url: 'https://api.github.com/repos/intrahouseio/ih-dbagent-sqlite/releases/latest',
     type: 'dbagent'  // def - plugin
    }
  ];
  */

  for (const item of systemPlugins) {
    try {
      const dest = getPathToUpdate(item);
      if (dest) await updatePlugin(item, dest);
    } catch (e) {
      console.log('ERROR:  update ' + item.name + util.inspect(e));
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

    if (updateutil.compareSemVer(version, info.version)) return folder;
  } catch (e) {
    console.log('WARN: Update system plugin ' + name + '. Reason: ' + util.inspect(e));
  }
  return folder;
}

async function updatePlugin({ name, url }, dest) {
  let res;
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
      console.log('ERROR:  update plugin  ' + util.inspect(e));
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

    console.log('INFO: Upzip to ' + tempdir);
    await wu.unzipP({ src: zipfile, dest: tempdir });

    // const workpath = appconfig.get('workpath');

    const backup = updateutil.getBackupFolder(name + '_v' + res.newversion);
    await wu.rsyncP({ src: tempdir, dest, backup, flags: ' -arc -v' });

    // Удалить исходники
    fut.delFileSync(zipfile);
    fut.delFolderSync(tempdir);
    console.log('INFO: rsync ' + tempdir + ' ' + dest + ' --backup --backup-dir=' + backup);
  } catch (e) {
    console.log('ERROR:  update ' + name + util.inspect(e));
    throw { message: 'Ошибка при закачке обновлений ' + name };
  }
}
