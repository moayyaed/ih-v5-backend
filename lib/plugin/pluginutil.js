/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const hut = require('../utils/hut');

const dm = require('../datamanager');

async function getPopupPlugin(id, nodeid) {
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);

  // Поверить, что nodeid - это узел (папка плагина) или находимся внутри, тогда можно добавить экземпляр
  let instanse;
  const unitDoc = await dm.findRecordById('units', nodeid);
  console.log('WARN:  getPopupPlugin nodeid='+nodeid+util.inspect(unitDoc));

  if (unitDoc) {
    if (unitDoc.folder && unitDoc._id.startsWith('plugin_')) {
      instanse = unitDoc._id.substr(7);
    } else if (unitDoc.parent.startsWith('plugin_')) {
      instanse = unitDoc.parent.substr(7);
    }
  }
  if (instanse) {
    // Найти новый номер
    const newId = await calcNewUnitId(instanse);
    return {data:[{id:newId, title:'Новый экземпляр плагина: '+newId}]};
  }

  // иначе сформировать список установленных, но не добавленных плагинов
  // 
  return { data: [] };

  /*
  switch (id) {
    case 'plugincommand':
      return getPopupPluginCommands(nodeid);
   
    case 'plugininstance':
      return { data: [] }; // Поверить, что это узел (папка плагина), тогда можно добавить
    default:
      return { data: [] };
  }
  */
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
  getPopupPlugin
};
