/**
 * updateSystem.js
 *
 * Обновление системы
 */

const util = require('util');

const updateutil = require('./updateutil');
const appconfig = require('../appconfig');
const wu = require('../utils/wrappers');
const nu = require('../utils/netutil');
const fut = require('../utils/fileutil');

module.exports = async function(param) {

  // res = await updateutil.getLatest();
  const res = await updateutil.getUpdateInfo(true);

  return { alert: 'info', message: 'res='+util.inspect(res) };

  if (!res) {
    console.log('INFO: Установлена последняя версия');
    return { alert: 'info', message: 'Установлена последняя версия' };
  }

  if (res.error) {
    console.log('ERROR: updateSystem ' + res.error);
    return { alert: 'info', message: res.error };
  }

  let url;
  let installedVersion;
  if (res.url) {
    url = res.url;
    installedVersion = res.newversion;
  } else if (res.beta_url) {
    if (param == 'beta') {
      url = res.beta_url;
      installedVersion = res.newbetaversion;
    } else {
      return { alert: 'info', message: 'Установлена последняя версия' };
    }
  } else {
    console.log('ERROR: updateSystem No url in response!');
    return { alert: 'info', message: 'Ошибка при проверке обновления: No url in response!' };
  }

  const name = appconfig.get('name_service');
  let zipfile = updateutil.getFilenameForZip(name);
  let ct;
  let location;

  try {
    // if (!res.assets || !res.assets[0]) throw { message: 'Expect assets, get ' + util.inspect(res) };
    // const url = res.assets[0].browser_download_url;
    // if (!url) throw { message: 'Expect browser_download_url in assets, get ' + util.inspect(res) };

    console.log('INFO: updateSystem ' + url);
    ct = await nu.httpDownloadP(url, zipfile);
  } catch (e) {
    if (typeof e == 'string') {
      location = e.substr(9);
    } else {
      console.log('ERROR:  updateSystem  ' + util.inspect(e));
      throw { message: 'Ошибка при закачке обновлений!' };
    }
  }

  try {
    if (location) {
      console.log('INFO: updateSystem => 302 location ' + location);
      ct = await nu.httpDownloadP(location, zipfile);
    }
    console.log('INFO: updateSystem => Content-type: ' + ct + '. Saved to file ' + zipfile);
    let tempdir = appconfig.getTmpFolder(name); // Временная папка для разархивирования

    console.log('INFO: Upzip to ' + tempdir);
    await wu.unzipP({ src: zipfile, dest: tempdir });

    const workpath = appconfig.get('workpath');

    // Удалить папку frontend
    const frontendPath = workpath + '/frontend';
    console.log('INFO: delete folder ' + frontendPath);
    fut.delFolderSync(frontendPath);

    const backup = updateutil.getBackupFolder('v' + res.newversion);
    await wu.rsyncP({ src: tempdir, dest: workpath, backup, flags: ' -arc -v' });

    // Удалить исходники
    fut.delFileSync(zipfile);
    fut.delFolderSync(tempdir);
    console.log('INFO: rsync ' + tempdir + ' ' + workpath + ' --backup --backup-dir=' + backup);

    appconfig.setNewversion('system', '');
    return {
      alert: 'info',
      message: 'Установлена версия ' +  installedVersion,
      // message: 'Установлена версия ' + updateutil.getVesionNumbers(res.newversion),
      ok: 1,
      refresh: true
    };
  } catch (e) {
    console.log('ERROR:  updateSystem  ' + util.inspect(e));
    throw { message: 'Ошибка при закачке обновлений!' };
  }
};
