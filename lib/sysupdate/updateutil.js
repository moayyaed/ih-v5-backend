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


/** getProducts
 * Получить список плагинов с сервера обновлений
 *
 *  => {"res":1,"data":{"status":1,"payload":[{"id":"opcua","type":"plugin","description":"OPCUA client","version":"v5.5.2","license":0},
 * @return {Object || Array of Objects}
 *   - возвращает массив - содержимое payload
 *   - возвращает { error: <текст ошибки> }
 * 
 *  @throw - если недоступен сервер обновлений
 */
async function getProducts() {
  let req = 'https://update.ih-systems.com/restapi/products';
  let result;
  try {
    result = await nu.httpGetJsonP(req);
  } catch (e) {
    console.log('ERROR:  updateSystem \nReq: ' + req + '\n error: ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }

  const err = checkResult(req, result);
  if (err) return err;
  return result.data.payload;
}

function checkResult(req, result) {
  let errStr = 'ERROR:  updateSystem \nReq: ' + req + '\n ' + util.inspect(result) + ' ';

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
}

/**
 *
 * @param {String} plugin - id плагина
 *
 *  @return {Object}
 *    - {newversion, url} - если требуется обновление!!
 *    - ничего не возвращает, если обновление не требуется
 *    - {error} - если ошибка прикладного уровня
 *
 *  @throw - если недоступен сервер обновлений
 *
 */
async function getUpdateInfo(updating, plugin = '', rollback) {
  const name = plugin || appconfig.getConfName();

  let updateReq = 'https://update.ih-systems.com/restapi/version?id=' + name;
  if (updating) updateReq += '&hw=' + appconfig.get('hwid');

  // { res: 1, data: { status: 1, payload: {url, version} } }
  let result;
  try {
    result = await nu.httpGetJsonP(updateReq);
    console.log('WARN: Res:' + util.inspect(result));
  } catch (e) {
    console.log('ERROR:  updateSystem \nReq: ' + updateReq + '\n error: ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }

  const err = checkResult(updateReq, result);
  if (err) return err;

  if (!result.data.payload || !result.data.payload.version || !result.data.payload.url) {
    console.log('ERROR:  updateSystem \nReq: ' + updateReq + '\n Missing "url" or "version" in response!');
    return { error: result.message || 'Missing "url" or "version" in response!' };
  }
  if (plugin) return result.data.payload.url;

  const currentVersion = appconfig.get('version');
  const newversion = result.data.payload.version;
  if (rollback) return  { url: result.data.payload.url, newversion };
  
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
  const version = hut.getVesionNumbers(result.tag_name);
  const cmp = hut.compareSemVer(version, currentVersion);
  if (cmp) {
    console.log('INFO: ' + appconfig.get('version') + '<' + version);
    result.newversion = version;
    return result;
  }
  console.log('INFO: ' + url + ' ' + currentVersion + ' = ' + version + '. Обновление не требуется');
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

/** downloadAndUnzip
 *
 * @param {String} name
 * @param {String} url
 * 
 * @throw
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

/** unzipAndDive
 * Разархивировать zipfile
 *
 * Если архив помещен внуть папки, то войти внутрь
 *
 * @return {String} путь к папке с контентом
 **/
async function unzipAndDive(zipfile, tempdir) {
  await wu.unzipP({ src: zipfile, dest: tempdir });

  const files = await fs.promises.readdir(tempdir);
  if (!files || !files.length) throw { message: 'Empty content extracted from ' + zipfile };
  if (files.length > 1) return tempdir;

  const one = path.join(tempdir, files[0]);
  const stats = await fs.promises.stat(one);
  return stats.isDirectory() ? one : tempdir;
}

module.exports = {
  getProducts,
  getUpdateInfo,
  getLatest,
  getBackupFolder,
  getFilenameForZip,
  unzipAndDive,
  downloadAndUnzip
};
