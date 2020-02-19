/**
 * firststart.js
 */

// const util = require('util');
const child = require('child_process');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');


exports.start = function start(uobj, startModule, holder) {
  const pluginspath = appconfig.get('pluginspath');
  const id = uobj.id;

  if (!needInstall(uobj)) {
    if (!uobj.suspend) startModule(id);
    return;
  } 
  
  doInstall( err => {
      if (!err) {
        if (!uobj.suspend) startModule(id);
      } else {
        holder.logErr(err, 'Module ' + id + ' install error. ');
      }
  });
 

  /**
   * 
   */
  function needInstall() {
    //  Для файлов js (runMethod = 1)
    if (!uobj || !uobj.runMethod) return;

    let ppath = `${pluginspath}/${uobj.plugin}`;
    let f_install = `${ppath}/install.sh`;
    if (fs.existsSync(f_install)) {
      hut.checkFileAndChangeModeSync(f_install, 0o777);
      uobj.install = 1;
      return true;
    }

    // Проверить, если есть package.json и нет node_modules - нужно установить!!
    let f_package = `${ppath}/package.json`;
    let node_modules = `${ppath}/node_modules`;
    return fs.existsSync(f_package) && !fs.existsSync(node_modules);
  }

  function doInstall(callback) {
    const ppath = `${pluginspath}/${uobj.plugin}`;

    if (uobj.install) {
      child.exec('sudo ./install.sh', { cwd: ppath }, (error, stdout, stderr) => {
        if (error) {
          holder.logErr('Plugin ' + uobj.id + ` install.sh error! stdout: ${stdout} stderr: ${stderr}`);
          if (callback) callback(error);
        } else {
          // Удаляем файл install
          fs.unlink(ppath + '/install.sh', err => {
            // Результата не ждем, но в случае ошибки запишем в Лог
            if (err) holder.logErr(err, 'File unlink error!  ' + ppath + '/install.sh');
          });
          uobj.install = 0;
          npmInstall();
        }
      });
    } else npmInstall();

    function npmInstall() {
      const str = appconfig.getNpmInstallStr();

      child.exec(str, { cwd: ppath }, (error, stdout, stderr) => {
        if (error) holder.logErr('Plugin ' + uobj.id + ` npm install error! stdout: ${stdout} stderr: ${stderr}`);

        if (callback) callback(error);
      });
    }
  }
}
