/**
 *  updateutils.js
 */
const util = require('util');
const fs = require('fs');
const path = require('path');

// const hut = require('./hut');
const appconfig = require('../appconfig');
const wu = require('./wrappers');
const nu = require('./netutil');
const fut = require('../utils/fileutil');

async function checkUpdateSystem() {
  try {
    let message = 'Установлена последняя версия ';
    const res = await getLatest();
    if (res) {
      message = 'Доступна версия ' + res.tag_name;
      appconfig.setNewversion('system', res.tag_name);
    }
    return { alert: 'info', message, refresh:true };
  } catch (e) {
    console.log('ERROR: checkUpdateSystem ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }
}

async function getLatest() {
  const url = 'https://api.github.com/repos/intrahouseio/ih-v5/releases/latest';
  const result = await nu.httpGetJsonP(url);
  const version = getVesionNumbers(result.tag_name);
  return appconfig.get(version) != version ? result : '';
}

function getVesionNumbers(version) {
  return version && isNaN(version.substr(0, 1)) ? version.substr(1) : version;
}

/**
 * Обновление системы
 * Надо запросить JSON опять
 */
async function updateSystem() {
  // const url = 'https://github.com/intrahouseio/ih-v5/releases/download/v5.1.3/ih-systems.zip';
  let res;
  try {
    res = await getLatest();
    if (!res) return { alert: 'info', message:'Установлена последняя версия' };
  } catch (e) {
    console.log('ERROR:  updateSystemm getLatest ' + util.inspect(e));
    throw { message: 'Недоступен сервер обновлений!' };
  }

  const name = 'ih-v5';
  let zipfile = getFilenameForZip(name);
  let ct;
  let location;

  try {
    if (!res.assets || !res.assets[0]) throw { message: 'Expect assets, get ' + util.inspect(res) };
    const url = res.assets[0].browser_download_url;
    if (!url) throw { message: 'Expect browser_download_url in assets, get ' + util.inspect(res) };
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
    const backup = getBackupFolder(name);
    await wu.rsyncP({ src: tempdir, dest: workpath, backup, flags: ' -arc -v' });

    // Удалить исходники
    fut.delFileSync(zipfile);
    fut.delFolderSync(tempdir);
    console.log('INFO: rsync ' + tempdir+' '+workpath +' --backup --backup-dir=' + backup);

    return { alert: 'info', message:'Установлена версия '+res.tag_name, ok:1, restart: };
  } catch (e) {
    console.log('ERROR:  updateSystem  ' + util.inspect(e));
    throw { message: 'Ошибка при закачке обновлений!' };
  }
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

// from=4.0 to=4.2
async function projectUpgrade(project, from, to) {
  console.log('WARN: NEED upgrade project ' + project + ' v' + from + ' to v' + to);
  if (!project || !from || !to || from.indexOf('.') <= 0 || to.indexOf('.') <= 0) {
    return;
  }

  let zipfile;
  const projectpath = appconfig.get('projectpath');
  try {
    // const  zipfile = await zipProject(config.projectpath, appconfig.getTmpZipPath(config.project));
    // await wu.zipP({ src, dest });

    const scriptArr = gatherScriptArr(from, to);
    if (scriptArr.length > 0) await runUpgradeScripts(projectpath, scriptArr);
    // Проставить версию в проекте
    appconfig.setTheProjectVersion(project);
    console.log('WARN: Upgrade OK');
  } catch (e) {
    console.log('ERROR: Project Upgrade error. ' + e.message);
    // восстанавливаем из архива, если он есть
    if (zipfile) {
      await wu.unzipP({ src: zipfile, dest: projectpath });
      console.log('WARN: Restore project from: ' + zipfile);
    }
  }
}

function gatherScriptArr(from, to) {
  const upScriptPath = `${appconfig.get('appdir')}/upgrade`;
  const scriptArr = [];
  // Создать массив имен скриптов, если они существуют
  let fromx = Number(from.split('.').pop());
  let tox = Number(to.split('.').pop());

  if (fromx < tox) {
    for (let i = fromx; i < tox; i++) {
      let file = `${upScriptPath}/up_${i}_${i + 1}.js`;

      if (fs.existsSync(file)) {
        scriptArr.push(file);
        console.log('WARN: Exists upgrade script ' + file);
      }
    }
  }
  return scriptArr;
}

function runUpgradeScripts(projectpath, all) {
  let promise = Promise.resolve();
  all.forEach(script => {
    promise = promise.then(() => runOne(script));
  });
  return promise;

  function runOne(script) {
    return new Promise((resolve, reject) => {
      require(script)(projectpath)
        .then(() => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
  }
}

module.exports = {
  projectUpgrade,
  checkUpdateSystem,
  updateSystem,
  getLatest
};
