/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const fs = require('fs');
// const child = require('child_process');
// const path = require('path');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

async function installShIfExists(pluginid) {
  const ppath = appconfig.getThePluginPath(pluginid);
  return (fs.existsSync(`${ppath}/install.sh`)) ? execInstallSh(ppath ) : '';
}

async function execInstallSh(ppath ) {
  const installFile = `${ppath}/install.sh`;
  let result = 'Try exec install.sh \n';
  try {
    fut.checkFileAndChangeModeSync(installFile, 0o777);
    result += await  wu.tryRunCmdP('sudo ./install.sh', { cwd: ppath });
    result += '\n';
    // await - удалить install.sh
    await fs.promises.unlink(installFile);

  } catch (err) {
    result += err.message; // Если ошибка произошла при удалении
  }
  return result;
}

async function installNpmIfNeed() {
  
}

async function getPopupPlugin(id, nodeid) {
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);

  /*
  // Поверить, что nodeid - это узел (папка плагина) или находимся внутри, тогда можно добавить экземпляр
  let instanse;
  const unitDoc = await dm.findRecordById('units', nodeid);
  console.log('WARN:  getPopupPlugin nodeid='+nodeid+util.inspect(unitDoc));

  if (unitDoc) {
    if (unitDoc.folder && unitDoc._id.startsWith('plugin_')) {
      instanse = unitDoc._id.substr(7);
    } else if (unitDoc.parent && unitDoc.parent.startsWith('plugin_')) {
      instanse = unitDoc.parent.substr(7);
    }
  }
  if (instanse) {
    // Найти новый номер
    const newId = await calcNewUnitId(instanse);
    return {data:[{id:newId, title:'Новый экземпляр плагина: '+newId}]};
  }

  // иначе сформировать список установленных, но не добавленных плагинов
  const pluginNames = await getAvailablePlugins();
  return {data:pluginNames.map( name => ({id:name, title:name }))};
  */
  const data = [
    { "id": "1", "type": "remote", "title": "Dynamic Add", "command": "addNodeByContext", "popupid": "pluginnew" },
    { "id": "3", "type": "divider" },
    { "id": "7", "type": "item", "title": "May be Delete", "command": "delete" }
  ];
  return {data};
}

async function getAvailablePlugins() {
  let result = [];
  let unitDocs
  try {
    // Считать папки в папке plugins
    const folder = appconfig.get('pluginspath');
    const pluginNames = fut.readFolderSync(folder, { dir: 1 });
    
    // TODO - проверить, что это плагин

  
   //  const promises = dbnames.map(name => createNewRecord(name));
  // changeDocs = await Promise.all(promises);
  // Вернуть список доступных плагинов (есть в папке, нет в проекте)
    unitDocs = await dm.dbstore.get('units');
    
    for (const name of pluginNames) {
      if (!unitExists(name)) result.push(name);
    }

  } catch (e) {
    console.log('ERROR: getAvailablePlugins ' + util.inspect(e));
  }
  return result;

  function unitExists(id) {
    for (const item of unitDocs) {
      if (item._id == id || item.parent == 'plugin_'+id) return true;
    }
  }
}

// TODO заглушка  Нужно взять из манифеста плагина
async function getPopupPluginCommands(nodeid) {
  if (!nodeid) throw { message: 'Expected nodeid for type=popup&id=plugincommand' };
  return {
    data: [
      { id: 'command1_' + nodeid, title: 'Command 1 ' + nodeid },
      { id: 'command2_' + nodeid, title: 'Command 2 ' + nodeid },
      { id: 'command3_' + nodeid, title: 'Command 3 ' + nodeid }
    ]
  };
}

async function calcNewUnitId(plugin) {
  // if (plugin.single) return plugin.id;
  const unitDocs = await dm.dbstore.get('units');
  return hut.calcNewId(unitDocs, '_id', plugin);
}

module.exports = {
  getPopupPlugin,
  installShIfExists,
  installNpmIfNeed
};
