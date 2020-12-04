/**
 * pluginpopup.js
 *
 */

// const util = require('util');

const appconfig = require('../appconfig');
const pluginutil = require('../plugin/pluginutil');

async function getPopupPlugin(id, nodeid) {
  if (id == 'plugins') return getMainPluginPopup(nodeid);
  if (id == 'pluginnew') return getPluginNewPopup();
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);

  if (id == 'plugin_dbagents') return getMainDbagentPopup(nodeid);
  if (id == 'plugin_dbagentnew') return getDbagentNewPopup();
  return { data: [] };
}

async function getPluginNewPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('pluginspath'), 'units');
  return { data: pluginNames.map(name => ({ id: name, title: name })) };
}

async function getMainDbagentPopup(nodeid) {
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
}

async function getDbagentNewPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await pluginutil.getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
  return { data: pluginNames.map(name => ({ id: name, title: name })) };
}

async function getMainPluginPopup(nodeid) {
  // Plugins -> Активировать установленные; Загрузить из zip
  if (nodeid == 'unitgroup') {
    return {
      data: [
        {
          id: '1',
          type: 'remote',
          title: appconfig.getMessage('ActivatePlugin'),
          command: 'addNodeByContext',
          popupid: 'pluginnew'
        },
        { id: '2', type: 'item', title: appconfig.getMessage('ZipUploading'), command: 'upload', param: 'plugin' }
      ]
    };
  }

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
        { id: '1', title: appconfig.getMessage('AddInstance') + ' ' + newId, command: 'addNodeByContext' },
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
