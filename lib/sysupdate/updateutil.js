/**
 *  updateutil.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../utils/hut');
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

/**
 *
 * @param {String} name - id системы или плагина
 *
 *  @return {Object}
 *    - {newversion, url} - если требуется обновление!!
 *    - ничего не возвращает, если обновление не требуется
 *    - {error} - если ошибка прикладного уровня
 *
 *  @throw {message:'Недоступен сервер обновлений!}
 *
 */
async function getUpdateInfo(updating) {
  const name = appconfig.getConfName();

  const currentVersion = appconfig.get('version');

  let updateReq = 'https://update.ih-systems.com/restapi/version?id=' + name;
  if (updating) updateReq += '&hw=' + appconfig.get('hwid');

  // console.log('WARN: Req: '+updateReq)

  // { res: 1, data: { status: 1, payload: {url, version} } }
  let result;
  try {
    result = await nu.httpGetJsonP(updateReq);
    console.log('WARN: Res:' + util.inspect(result));
  } catch (e) {
    console.log('ERROR:  updateSystem \nReq: ' + updateReq + '\n error: ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }

  let errStr = 'ERROR:  updateSystem \nReq: ' + updateReq + '\n ' + util.inspect(result) + ' ';

  if (!result) {
    console.log(errStr + ' Empty response!');
    return { error: 'Empty response!' };
  }
  // res = 0
  if (!result.res) {
    console.log(errStr);
    return { error: result.message || 'Unexpected response!' };
  }
  if (!result.data) {
    console.log(errStr + ' \n Expected data in response!');
    return { error: result.message || 'Unexpected response!' };
  }
  if (!result.data.status) {
    console.log(errStr + ' => Status=0');
    return { error: result.data.message || result.message || 'Unexpected response!' };
  }
  if (!result.data.payload || !result.data.payload.version || !result.data.payload.url) {
    console.log(errStr + ' \n Expected data.payload with "url" and "version" in response!');
    return { error: result.message || 'Unexpected response!' };
  }

  const newversion = result.data.payload.version;
  const cmp = hut.compareSemVer(newversion, currentVersion);
  if (cmp) {
    // Есть новая стабильная версия - ее и показываем
    console.log('INFO: ' + currentVersion + '<' + newversion);
    return { url: result.data.payload.url, newversion };
  }
  if (result.data.payload.beta_version) {
    const newbetaversion = result.data.payload.beta_version;
    if (hut.compareSemVer(newbetaversion, currentVersion)) {
      return { beta_url: result.data.payload.beta_url, newbetaversion };
    }
  }
}

/*
{data":{"status":1,"payload":{"version":"v5.5.37",
        "url":"https://github.com/intrahouseio/ih-v5/releases/download/v5.5.37/intrahouse.zip",
        "beta_version":null,
        "beta_url":null}}
      }
*/

async function getLatest(url, currentVersion) {
  if (!url) {
    url = 'https://api.github.com/repos/intrahouseio/ih-v5/releases/latest';
  }
  if (!currentVersion) {
    currentVersion = appconfig.get('version');
  }
  const result = await nu.httpGetJsonP(url);
  const version = getVesionNumbers(result.tag_name);
  const cmp = hut.compareSemVer(version, currentVersion);
  if (cmp) {
    console.log('INFO: ' + appconfig.get('version') + '<' + version);
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
/*
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
*/

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

/**
 *
 * @param {*} name
 * @param {*} url
 */
async function downloadAndUnzip(name, url) {
  const zipfile = getFilenameForZip(name);
  let ct;
  let location;

  try {
    console.log('INFO: update plugin ' + url);
    ct = await nu.httpDownloadP(url, zipfile);
  } catch (e) {
    if (typeof e == 'string') {
      location = e.substr(9);
    } else {
      console.log('ERROR:  downloadAndUnzip ' + name + ': ' + hut.getShortErrStr(e));
      throw { message: appconfig.getMessage('DownloadError') };
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
    const folder = await unzipAndDive(zipfile, tempdir);
    // Удалить исходники
    fut.delFileSync(zipfile);
    return folder;
  } catch (e) {
    console.log('ERROR:  downloadAndUnzip ' + name + ': ' + hut.getShortErrStr(e));
    throw { message: appconfig.getMessage('DownloadError') };
  }
}
/*
async function updatePlugin({ type, name, url }, dest) {
  let zipfile = getFilenameForZip(name);
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
    const src = await unzipAndDive(zipfile, tempdir);

    // Если папки dest нет - создать ее
    fut.checkAndMakeFolder(dest);
    await wu.cpP({ src, dest });
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
    console.log('INFO: Updated ' + name + '. Version: ' + info.version);
  } catch (e) {
    console.log('WARN: After Update system plugins ' + name + '. ' + hut.getShortErrStr(e));
  }
}
*/

module.exports = {
  getUpdateInfo,
  unzipAndDive,
  getLatest,
  getVesionNumbers,
  getBackupFolder,
  getFilenameForZip,
  downloadAndUnzip
};
