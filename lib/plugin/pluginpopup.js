/**
 * pluginpopup.js
 *
 */

// const util = require('util');

const appconfig = require('../appconfig');
const datagetter = require('../appspec/datagetter');

async function getPopupPlugin(id, nodeid) {
  if (id == 'plugins') return getMainPluginPopup(nodeid);
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);

  if (id == 'plugin_dbagents') return getMainDbagentPopup(nodeid);
  return { data: [] };
}

async function getMainDbagentPopup(nodeid) {
  if (nodeid == 'dbagentgroup') return getRootDbagentPopup();

  // Если агент активный - можно старт-стоп, иначе только удалить из проекта.
  const item = datagetter.getListItem('dbagentList', nodeid);
  const arr = [];
  if (item.active) {
    addStartStop();
  }
  arr.push({ id: 'delete', type: 'item', title: 'Удалить из проекта ' + nodeid, command: 'delete' });
  return { data: arr };

  function addStartStop() {
    arr.push({
      id: 'start',
      type: 'item',
      title: 'Запустить ' + nodeid,
      command: 'send',
      param: { emit: 'start:plugin' }
    });

    arr.push({
      id: 'stop',
      type: 'item',
      title: 'Остановить ' + nodeid,
      command: 'send',
      param: { emit: 'stop:plugin' }
    });

    arr.push({ id: '3', type: 'divider' });
  }
}

async function getRootDbagentPopup() {
  const pluginNames = await datagetter.getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
  const arr = [];
  pluginNames.forEach(name => {
    arr.push({
      id: name,
      type: 'item',
      command: 'addNodeByContext',
      title: 'Добавить агент БД ' + name
      // title: appconfig.getMessage('Activate') + ' ' + name
    });
  });
  return { data: arr };
}

async function getRootPluginPopup() {
  // сформировать список установленных, но не добавленных плагинов
  const pluginNames = await datagetter.getAvailablePlugins(appconfig.get('pluginspath'), 'units');

  const arr = [];
  pluginNames.forEach(name => {
    const single = datagetter.getPluginManifestProp(name, 'single');

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
  // arr.push({ id: '2', type: 'divider' });
  // arr.push({ id: '3', type: 'item', title: appconfig.getMessage('ZipUploading'), command: 'upload', param: 'plugin' });
  return { data: arr };
}

async function getMainPluginPopup(nodeid) {
  // Plugins -> Активировать установленные + Загрузить из zip
  // Установленные - сразу показать, так как есть папки (мультиплагины)
  if (nodeid == 'unitgroup') return getRootPluginPopup();

  // WIP -> Добавить экземпляр; деактивировать плагин WIP, удалить экземпляры (будут удалены плагины и все каналы)
  // wip7 - Старт/стоп?/Удалить экземпляр;
  // email - Старт/стоп?/Деактивировать плагин;

  const unitDoc = await datagetter.getUnitDoc(nodeid);
  if (!unitDoc) return { data: [] };

  if (unitDoc.folder && unitDoc._id.startsWith('plugin_')) {
    // Папка мультиплагина
    const plugin = unitDoc._id.substr(7);
    const newId = await datagetter.calcNewUnitId(plugin);
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
