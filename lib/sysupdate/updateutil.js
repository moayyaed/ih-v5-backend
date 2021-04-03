/**
 *  updateutil.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

// const hut = require('./hut');
const appconfig = require('../appconfig');
const nu = require('../utils/netutil');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

/**
 * Разархивировать zipfile
 * 
 * Если архив помещен внуть папки, то войти внутрь
 * 
 * Вернуть путь к папке с контентом
 **/ 
async function unzipAndDive(zipfile, tempdir) {
  // console.log('WARN: Uploaded file was saved to ' + zipfile + '. Unzip to  ' + tempdir);
  await wu.unzipP({ src: zipfile, dest: tempdir });

  const files = await fs.promises.readdir(tempdir);
  if (!files || !files.length) throw { message: 'Empty content extracted from ' + zipfile };
 
  if (files.length > 1) return tempdir;

  const one = path.join(tempdir, files[0]);
  const stats = await fs.promises.stat(one);
  return stats.isDirectory() ? one : tempdir;
}

async function getLatest(url, currentVersion) {
  if (!url) {
    url = 'https://api.github.com/repos/intrahouseio/ih-v5/releases/latest';
  }
  if (!currentVersion) {
    currentVersion = appconfig.get('version');
  }
  const result = await nu.httpGetJsonP(url);
  const version = getVesionNumbers(result.tag_name);
  const cmp = compareSemVer(version, currentVersion);
  if (cmp) {
    console.log('INFO: '+appconfig.get('version')+'<'+version);
    result.newversion = version;
    return result;
  }
  console.log('INFO: ' + url + ' ' + currentVersion + ' = ' + version + '. Обновление не требуется');
}

function getVesionNumbers(version) {
  return version && isNaN(version.substr(0, 1)) ? version.substr(1) : version;
}

/**
 * Сравнение версий SemVer  MAJOR.MINOR.PATCH
 *   1.0.0-alpha < 1.0.0
 * @param {} newversion
 * @param {*} current
 * @return {Number} -   1-Major 2-Minor 3-patch; 0 - equal or lower
 */
function compareSemVer(newversion, current) {
  if (!newversion || !current) return 0;
  const newArr = newversion.split('.');
  const curArr = current.split('.');
  if (newArr.length < 3) return 0;

  for (let i = 0; i < 3; i++) {
    if (parseInt(curArr[i], 10) < parseInt(newArr[i], 10)) return i + 1;
  }
  return 0;
}

function getBackupFolder(name) {
  let folder = path.join(appconfig.get('workpath'), './versions');
  fut.checkAndMakeFolder(folder);
  // Если вложенная папка существует - удалить ее
  if (fs.existsSync(folder + '/' + name)) {
    fut.removeFolderSync(folder + '/' + name);
  }
  // return `${folder}/v${cv}`; // For ex: /var/lib/intrahouse-c/versions/pluginid/v0.0.2
  return folder; // For ex: /var/lib/intrahouse-c/versions;
}

function getFilenameForZip(name) {
  let zipfile = path.join(appconfig.getTmpFolder(), name + '.zip');
  if (fs.existsSync(zipfile)) fs.unlinkSync(zipfile);
  return zipfile;
}

module.exports = {
  unzipAndDive,
  getLatest,
  getVesionNumbers,
  compareSemVer,
  getBackupFolder,
  getFilenameForZip
};
