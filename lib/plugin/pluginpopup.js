/**
 * pluginpopup.js
 *
 */

// const util = require('util');

const appconfig = require('../appconfig');
const pluginutil = require('../plugin/pluginutil');

async function getPopupPlugin(id, nodeid) {
  if (id == 'plugins') return getMainPluginPopup(nodeid);
  // if (id == 'pluginnew') return getPluginNewPopup();
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);

  if (id == 'plugin_dbagents') return getMainDbagentPopup(nodeid);
  // if (id == 'plugin_dbagentnew') return getDbagentNewPopup();
  return { data: [] };
}

/*
async function getPluginNewPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('pluginspath'), 'units');
  return { data: pluginNames.map(name => ({ id: name, title: name })) };
}
*/

async function getMainDbagentPopup(nodeid) {
  // Если агента нет - в корне добавить список?
  // Если есть - то можно только удалить  агента
  if (nodeid == 'dbagentgroup') {
    if (appconfig.get('project_dbname')) return { data: [] };

    const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
    const arr = [];
    pluginNames.forEach(name => {
      arr.push({
        id: name,
        type: 'item',
        command: 'addNodeByContext',
        title: appconfig.getMessage('Activate') + ' ' + name
      });
    });
    arr.push({ id: '2', type: 'divider' });
    arr.push({
      id: '3',
      type: 'item',
      title: appconfig.getMessage('ZipUploading'),
      command: 'upload',
      param: 'dbagent'
    });
    return { data: arr };
  }

  return {
    data: [
      {
        id: '1',
        type: 'item',
        title: appconfig.getMessage('RunPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'start:plugin' }
      },
      {
        id: '2',
        type: 'item',
        title: appconfig.getMessage('StopPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'stop:plugin' }
      },
      { id: '3', type: 'divider' },
      { id: '4', type: 'item', title: appconfig.getMessage('Deactivate') + ' ' + nodeid, command: 'delete' }
    ]
  };

  /*
  const item =
    nodeid == 'dbagentgroup'
      ? {
          id: '1',
          type: 'remote',
          title: appconfig.getMessage('Activate'),
          command: 'addNodeByContext',
          popupid: 'plugin_dbagentnew'
        }
      : { id: '3', type: 'item', title: appconfig.getMessage('Deactivate') + ' ' + nodeid, command: 'delete' };
  return { data: [item] };
*/
}

/*
async function getDbagentNewPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
  return { data: pluginNames.map(name => ({ id: name, title: name })) };
}
*/

async function getRootPluginPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('pluginspath'), 'units');

  const arr = [];
  pluginNames.forEach(name => {
    const single = pluginutil.getPluginManifestProp(name, 'single');

    // Если у плагина нет манифеста - не добавляю
    if (single !== null) {
      const id = single ? name : 'plugin_' + name;
      arr.push({
        id,
        type: 'item',
        command: 'addNodeByContext',
        title: appconfig.getMessage('ActivatePlugin') + ' ' + name.toUpperCase()
      });
    }
  });
  arr.push({ id: '2', type: 'divider' });
  arr.push({ id: '3', type: 'item', title: appconfig.getMessage('ZipUploading'), command: 'upload', param: 'plugin' });
  return { data: arr };
}

async function getMainPluginPopup(nodeid) {
  // Plugins -> Активировать установленные + Загрузить из zip
  // Установленные - сразу показать, так как есть папки (мультиплагины)
  if (nodeid == 'unitgroup') return getRootPluginPopup();

  // WIP -> Добавить экземпляр; деактивировать плагин WIP, удалить экземпляры (будут удалены плагины и все каналы)
  // wip7 - Старт/стоп?/Удалить экземпляр;
  // email - Старт/стоп?/Деактивировать плагин;

  const unitDoc = await pluginutil.getUnitDoc(nodeid);
  if (!unitDoc) return { data: [] };

  if (unitDoc.folder && unitDoc._id.startsWith('plugin_')) {
    // Папка мультиплагина
    const plugin = unitDoc._id.substr(7);
    const newId = await pluginutil.calcNewUnitId(plugin);
    return {
      data: [
        { id: newId, title: appconfig.getMessage('AddInstance') + ' ' + newId, command: 'addNodeByContext' },
        { id: '3', type: 'divider' },
        { id: '4', type: 'item', title: appconfig.getMessage('DeleteAllInstances'), command: 'delete' }
      ]
    };
  }

  // Single плагин -  можно деактивировать Экземпляр мультиплагина - удалить По сути одно и то же
  const deleteTitle = unitDoc.parent.startsWith('plugin_') ? 'DeleteInstance' : 'DeactivatePlugin';
  return {
    data: [
      {
        id: '1',
        type: 'item',
        title: appconfig.getMessage('RunPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'start:plugin' }
      },
      {
        id: '2',
        type: 'item',
        title: appconfig.getMessage('StopPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'stop:plugin' }
      },
      { id: '3', type: 'divider' },
      { id: '4', type: 'item', title: appconfig.getMessage(deleteTitle) + ' ' + nodeid, command: 'delete' }
    ]
  };
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

module.exports = {
  getPopupPlugin
};
