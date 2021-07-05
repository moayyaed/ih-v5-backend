/**
 * pluginpopup.js
 *
 */

const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const pluginutil = require('../plugin/pluginutil');

const domaindata = require('./domaindata');

async function getPopupPlugin(query, holder) {
  const { id, nodeid } = query;
  if (id == 'plugins') return getMainPluginPopup(nodeid);
  if (id == 'plugincommand') return getPopupPluginCommands(nodeid);
  if (id == 'plugin_dbagents') return getMainDbagentPopup(nodeid);
  return { data: [] };

  async function getMainDbagentPopup() {
    if (nodeid == 'dbagentgroup') return getRootDbagentPopup();

    // Если агент активный - можно старт-стоп, иначе только удалить из проекта.
    const item = domaindata.getListItem('dbagentList', nodeid);
    const arr = [];
    if (item.active) {
      addStartStop();
    }
    // TODO - только если установлен DBGate
    /*
    if (arr.length) {
      arr.push({ id: '3', type: 'divider' });
    }
    arr.push({ id: 'delete', type: 'item', title: 'Удалить из проекта ' + nodeid, command: 'delete' });
    */

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
    }
  }

  async function getRootDbagentPopup() {
    const pluginNames = await getAvailablePlugins(appconfig.get('agentspath'), 'dbagents');
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
    if (arr.length) {
      arr.push({ id: 'div2', type: 'divider' });
    }
    addImportExportCsv();
    arr.push({ id: 'div3', type: 'divider' });
    arr.push({
      id: '3',
      type: 'item',
      title: 'Загрузить агент БД',
      command: 'upload',
      param: 'dbagent'
    });
    return { data: arr };

    function addImportExportCsv() {
      arr.push({
        id: 'export',
        type: 'item',
        title: 'Выгрузить правила записи в БД',
        command: 'export',
        param: 'devicedb:csv'
      });

      arr.push({
        id: 'import',
        type: 'item',
        title: 'Загрузить (заменить) правила записи в БД',
        command: 'upload',
        param: 'devicedb:csv'
      });
    }
  }

  async function getRootPluginPopup() {
    // сформировать список установленных, но не добавленных плагинов
    const pluginNames = await getAvailablePlugins(appconfig.get('pluginspath'), 'units');

    const arr = [];
    pluginNames.forEach(name => {
      const single = appconfig.getPluginManifestProp(name, 'single');

      // Если у плагина нет манифеста - не добавляю
      if (single !== null) {
        const xid = single ? name : 'plugin_' + name;
        arr.push({
          id: xid,
          type: 'item',
          command: 'addNodeByContext',
          title: appconfig.getMessage('ActivatePlugin') + ' ' + name.toUpperCase()
        });
      }
    });
    /*
    if (arr.length) {
      arr.push({ id: '2', type: 'divider' });
    }
    
    arr.push({
      id: '3',
      type: 'item',
      title: 'Загрузить плагин',
      command: 'upload',
      param: 'plugin'
    });
    */
    return { data: arr };
  }

  async function getMainPluginPopup() {
    // Plugins -> Активировать установленные + Загрузить из zip
    // Установленные - сразу показать, так как есть папки (мультиплагины)
    if (nodeid == 'unitgroup') return getRootPluginPopup();

    // WIP -> Добавить экземпляр; деактивировать плагин WIP, удалить экземпляры (будут удалены плагины и все каналы)
    // wip7 - Старт/стоп?/Удалить экземпляр;
    // email - Старт/стоп?/Деактивировать плагин;

    const unitDoc = await holder.dm.findRecordById('units', nodeid);
    if (!unitDoc) return { data: [] };

    if (unitDoc.folder && unitDoc._id.startsWith('plugin_')) {
      // Папка мультиплагина
      const plugin = unitDoc._id.substr(7);
      const newId = await pluginutil.calcNewUnitId(plugin, holder.dm);
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

    const arr = [
      {
        id: 'start',
        type: 'item',
        title: appconfig.getMessage('RunPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'start:plugin' }
      },
      {
        id: 'stop',
        type: 'item',
        title: appconfig.getMessage('StopPlugin') + ' ' + nodeid,
        command: 'send',
        param: { emit: 'stop:plugin' }
      },
      { id: '3', type: 'divider' }
    ];
    addImportExport();
    addCopyPaste();
    addLogExport();

    arr.push({
      id: 'delete',
      type: 'item',
      title: appconfig.getMessage(deleteTitle) + ' ' + nodeid,
      command: 'delete'
    });
    return { data: arr };

    function addCopyPaste() {
      arr.push({ id: 'copy', type: 'item', title: appconfig.getMessage('Copy'), command: 'copy' });
      arr.push({
        id: 'paste',
        type: 'item',
        title: appconfig.getMessage('Paste'),
        command: 'paste',
        check: 'disablePaste'
      });
      arr.push({ id: 'divcp', type: 'divider' });
    }

    function addImportExport() {
      arr.push({
        id: 'export',
        type: 'item',
        title: 'Выгрузить каналы в .csv',
        command: 'export',
        param: 'channels:csv'
      });

      arr.push({
        id: 'import',
        type: 'item',
        title: 'Загрузить каналы из .csv',
        command: 'upload',
        param: 'channels:csv'
      });

      arr.push({
        id: 'import',
        type: 'item',
        title: 'Загрузить каналы из .exp',
        command: 'upload',
        param: 'channels:exp'
      });

      arr.push({ id: 'divex', type: 'divider' });
    }

    function addLogExport() {
      arr.push({
        id: 'exportlog',
        type: 'item',
        title: 'Выгрузить лог плагина',
        command: 'export',
        param: 'extlog'
      });

      arr.push({ id: 'divexlog', type: 'divider' });
    }
  }

  // TODO заглушка  Нужно взять из манифеста плагина
  async function getPopupPluginCommands() {
    if (!nodeid) throw { message: 'Expected nodeid for type=popup&id=plugincommand' };
    return { data: [] };
    /*
    return {
      data: [
        { id: 'command1_' + nodeid, title: 'Command 1 ' + nodeid },
        { id: 'command2_' + nodeid, title: 'Command 2 ' + nodeid },
        { id: 'command3_' + nodeid, title: 'Command 3 ' + nodeid }
      ]
    };
    */
  }

  async function getAvailablePlugins(folder, collection) {
    const systemplugins = appconfig.getSystemplugins();
    const systemPluginSet = hut.arrayToObject(systemplugins, 'name');

    let result = [];
    let unitDocs;
    try {
      // Считать папки в папке folder
      const pluginNames = fut.readFolderSync(folder, { dir: 1 });

      // TODO - проверить, что это плагин

      // Вернуть список доступных плагинов (есть в папке, нет в проекте)
      unitDocs = await holder.dm.dbstore.get(collection);

      for (const name of pluginNames) {
        if (!systemPluginSet[name] && !unitExists(name)) result.push(name);
      }
    } catch (e) {
      console.log('ERROR: getAvailablePlugins ' + util.inspect(e));
    }
    return result;

    function unitExists(unitid) {
      for (const item of unitDocs) {
        if (item._id == unitid || item._id == 'plugin_' + unitid || item.parent == 'plugin_' + unitid) return true;
      }
    }
  }
}

module.exports = {
  getPopupPlugin
};
