/**
 * channelpopup.js
 */
const util = require('util');
const appconfig = require('../appconfig');

module.exports = async function(popupName, query, pluginPopupItem, holder) {
  // query:{method:get,type:popup,id:channel_folder_popup,navnodeid:mqttclient1,nodeid:mqttclient1_all}
  const res = [];
  let addDiv;
  let divCount = 1;

  if (pluginPopupItem) {
    if (pluginPopupItem.add) {
      add('add', Array.isArray(pluginPopupItem.add) ? pluginPopupItem.add : '');
    }

    if (pluginPopupItem.browse) {
      const browseParam = await formBrowseParam(pluginPopupItem.browse);
      add('browse', browseParam);
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
    // if (popupName == 'channel_folder_popup') add('scan');
    add('delete');
    add('plugincommand');
  }
  return res;

  async function formBrowseParam(browseItem) {
    const param = typeof browseItem == 'object' ? browseItem : {};
    if (param.variant == 'fields' && Array.isArray(param.fields)) {
      // Заполнить значения из узла
      // navnodeid=snmp1&nodeid=j8tJ-d0z5
      const doc = await holder.dm.findRecordById('devhard', query.nodeid);
      if (!doc) throw { message: 'Not found doc with id=' + query.nodeid };

      param.fields.forEach(item => {
        if (item.prop && doc[item.prop] != undefined) item.default = doc[item.prop];
      });
    }
    return param;
  }

  function add(id, itemParam) {
    if (addDiv) {
      res.push({ id: 'div' + divCount, type: 'divider' });
      addDiv = false;
      divCount++;
    }
    switch (id) {
      case 'add':
        // if (!children) children = getDefaultChildren(id);
        let children = itemParam;
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

      case 'browse':
        res.push({
          id: 'browse',
          type: 'item',
          title: 'Сканировать каналы',
          command: 'browse',
          param: itemParam
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
