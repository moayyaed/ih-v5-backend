/**
 * 
 * plugininstall.js
 */

// const util = require('util');
const fs = require('fs');

// const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');



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




module.exports = {
  installShIfExists
};