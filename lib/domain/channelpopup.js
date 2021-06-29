/**
 * channelpopup.js
 */
// const util = require('util');
const appconfig = require('../appconfig');

module.exports = function(popupName, pluginPopupItem) {
  const res = [];
  let addDiv;
  let divCount = 1;

  if (pluginPopupItem) {
    if (pluginPopupItem.add) {
      add('add', Array.isArray(pluginPopupItem.add) ? pluginPopupItem.add : '');
    }
    if (pluginPopupItem.copypaste) add('copypaste');
    if (popupName == 'channel_folder_popup') add('devicelink');
    if (pluginPopupItem.delete) add('delete');
    if (pluginPopupItem.plugincommand)
      add('plugincommand', Array.isArray(pluginPopupItem.plugincommand) ? pluginPopupItem.plugincommand : '');
  } else {
    add('add');
    add('copypaste');
    if (popupName == 'channel_folder_popup') add('devicelink');
    if (popupName == 'channel_folder_popup') add('scan');
    add('delete');
    add('plugincommand');
  }
  return res;

  function add(id, children) {
    if (addDiv) {
      res.push({ id: 'div' + divCount, type: 'divider' });
      addDiv = false;
      divCount++;
    }
    switch (id) {
      case 'add':
        if (!children) children = getDefaultChildren(id);
        res.push({
          id: 'add',
          type: 'item',
          title: appconfig.getMessage('Add'),
          command: 'addNodeByContext',
          children
        });
        addDiv = true;
        break;

      case 'copypaste':
        res.push({ id: 'copy', type: 'item', title: appconfig.getMessage('Copy'), command: 'copy' });
        res.push({
          id: 'paste',
          type: 'item',
          title: appconfig.getMessage('Paste'),
          command: 'paste',
          check: 'disablePaste'
        });
        addDiv = true;
        break;

      case 'devicelink':
        res.push({
          id: 'devicelink',
          type: 'item',
          title: 'Привязать к устройству',
          command: 'dialog',
          param: { variant: 'tree', title: 'Выберите устройство', id: 'devicesx', action: 'grouplink' }
        });
        addDiv = true;
        break;

      case 'scan':
          res.push({
            id: 'scan',
            type: 'item',
            title: 'Сканировать каналы',
            command: 'dialog',
            param: { variant: 'tree', title: 'Сканировать каналы', id: 'scanx', action: 'scan' }
          });
          addDiv = true;
          break;

      case 'delete':
        res.push({ id: 'delete', type: 'item', title: appconfig.getMessage('Delete'), command: 'delete' });
        addDiv = true;
        break;
      default:
    }
  }

  function getDefaultChildren(id) {
    switch (id) {
      case 'add':
        return [
          { id: 'folder', title: appconfig.getMessage('NewFolder') },
          { id: 'channel', title: appconfig.getMessage('NewChannel') }
        ];
      default:
        return [];
    }
  }
};
