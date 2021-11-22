/**
 * Project upgrade 5.5 => 5.6
 *
 * 1. Изменение наименования плагина интеграции applehomekit => applehome
 *
 *
 */

const util = require('util');
const fs = require('fs');

const hut = require('../lib/utils/hut');
const appconfig = require('../lib/appconfig');

const afrom = 'applehomekit';
const ato = 'applehome';

module.exports = async function(projectPath) {
  let msg;
  // Переименовать в units.db - просто заменить в файле? dbstore еще не поднят?
  try {
    msg = 'Replace unit: applehomekit => applehome';
    const filename = projectPath + '/jbase/unit.db';
    let str = fs.readFileSync(filename, 'utf8');
    if (str.indexOf(afrom)) {
      str.replace(/applehomekit/g, 'applehome');
      fs.writeFileSync(filename, str);
      console.log('INFO: ' + msg);
    }
  } catch (e) {
    console.log('ERROR: up_5_6:  ' + msg + ' error: ' + util.inspect(e));
  }

  // Переименовать в integrations/<applehomekit>/
  try {
    msg = 'Rename  integrations folder: applehomekit => applehome';
    const ifrom = projectPath + 'integrations/applehomekit';
    const ito = projectPath + 'integrations/applehome';
    if (fs.existsSync(ifrom)) {
      fs.renameSync(ifrom, ito);
    }
  } catch (e) {
    console.log('ERROR: up_5_6:  ' + msg + ' error: ' + util.inspect(e));
  }

  // Найти сам плагин (он уже м б переименован! или удален?)
  // Действия выполнять, только если версия плагина <= 5.0.6!!
  // (новый плагин для связи с железом тоже будет называться applehomekit!!)
  const pluginPath = appconfig.get('pluginspath') + '/applehomekit';
  if (!fs.existsSync(pluginPath)) return;

  try {
    msg = 'Rename  plugin: applehomekit => applehome';
    const ih_filename = pluginPath + '/applehomekit.ih';
    const ih_filename_new = pluginPath + '/applehome.ih';
    const man_filename = pluginPath + '/manifest.json';

    if (!doesPluginNeedRenaming(ih_filename)) return;

    // Удалить старый файл .ih
    fs.rmSync(ih_filename, { force: true });

    // Создать новый
    fs.writeFileSync(ih_filename_new, getNewIh());

    // Изменить в манифесте - файл будет перезаписан
    fs.writeFileSync(man_filename, getNewManifest());

    // Переименовать папку плагина
    fs.renameSync(pluginPath, appconfig.get('pluginspath') + '/applehome');
  } catch (e) {
    console.log('ERROR: up_5_6:  ' + msg + ' error: ' + util.inspect(e));
  }

  function doesPluginNeedRenaming(filename) {
    let oldVersion = true;
    try {
      const info = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (info.version) {
        oldVersion = hut.compareSemVer('5.1.0', info.version); // Вернет 1-3, если версия старее
      }
    } catch (e) {
      console.log('WARN: doesPluginNeedRenaming. Read ' + filename + ' error: ' + hut.getShortErrStr(e));
    }
    return oldVersion;
  }

  function getNewManifest() {
    return JSON.stringify({
      id: 'applehome',
      description: 'Apple Home Plugin',
      module: 'index.js',
      service: 'integration',
      servicename: 'Apple Home',
      i_devices: 1,
      i_types: 1,
      single: 1,
      nochannels: 1
    });
  }

  function getNewIh() {
    return JSON.stringify({
      id: 'applehome',
      description: 'Apple Home Plugin',
      activation: false,
      resources: false,
      cross: true,
      version: '5.0.9'
    });
  }
  
};
