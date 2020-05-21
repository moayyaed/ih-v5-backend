const util = require('util');

const hut = require('../utils/hut');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

const liststore = require('../dbs/liststore');
const typestore = require('../device/typestore');

const emObj = { '0': '❏', '1': '✔︎', '2': '✘' };
const exfieldtypeList = ['code', 'layout', 'container', 'template'];

function isExfieldtype(type) {
  return exfieldtypeList.includes(type);
}

function showHandlersForType(id) {
  return typestore.showHandlers(id);
}

function getEmptyValue(type) {
  switch (type) {
    case 'number':
      return null;
    case 'layout':
      return {};
    case 'container':
      return {};
    case 'template':
        return {};
    case 'cb':
      return 0;
    case 'tags':
      return [];
    default:
      return '';
  }
}

function chooseTreeItemComponent(item, desc) {
  if (desc.table == 'units') {
    // Найти в списке
    const listItem = liststore.getItemFromList('unitList', item.id);
    // Здесь нужно расширить логику!!
    return  (listItem.id == listItem.plugin) ? 'pluginview1Tab' : 'pluginview';
  }
}

async function loadList(listname) {
  const listdesc = descriptor.getDescItem('list', listname);

  const desc = descriptor.getTableDesc(listdesc.table);
  const projection = hut.getFieldProjection(listdesc.propmap);
  const data = await dm.dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

  // Сделать маппинг полей и сохранить в liststore
  const arr = hut.mapPropsStrict(data, listdesc.propmap);
  liststore.addList(listname, listdesc.table, arr);
}

/**
 * Возвращает список (droplist)
 * @param {String} id идентификатор (имя) списка
 *
 * Списки кэшируются в liststore
 * Описание списков (desc) находится в файле lists.json, который загружен в descriptor
 */
function getDroplist(listname) {
  const res = [{ id: '-', title: '' }];
  
  if (listname == 'readhandlers' || listname == 'writehandlers') {
   return getHandlerLists(listname);
  }

  if (liststore.hasList(listname)) {
    liststore.getListAsArray(listname).forEach(item => {
      res.push({ id: item.id, title: formTitle(listname, item) });
    });
  }
  return { data: res };
}

function getHandlerLists(listname) {
  const res = [{ id: '-', title: '' }];
  liststore.getListAsArray('handlerList').forEach(item => {
    res.push({ id: item.id, title: formTitle(listname, item) });
  });
  return { data: res };
}

function getDroplistItemFromList(listname, key) {
  const item = liststore.getItemFromList(listname, key);
  return item ? { id: item.id, title: formTitle(listname, item) } : { id: '-', title: '-' };
}

async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };

  return loadList(id);
}

function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';

  return getDroplistItemFromList(listdata, key);
  // await getList(listdata);

  // return liststore.getItemFromList(listdata, key);
}

function getDeviceTitle(did) {
  const item = liststore.getItemFromList('deviceList', did);
  return !item || !item.dn ? did + ': Device not found' : formTitle('deviceList', item);
}

/*
function formDeviceTitle(item) {
  return item.dn + ' ▪︎ ' + item.name;
}
*/

function getSceneTitle(id) {
  const item = liststore.getItemFromList('sceneList', id);
  return item ? formTitle('sceneList', item) : id + ': Scene not found';
}

function formTitle(listname, item) {
  let emo;
  switch (listname) {
    case 'deviceList':
      return item.dn + ' ▪︎ ' + item.name;
    case 'sceneList':
      emo = emObj[item.status] || emObj['0'];
      return emo + ' ' + item.name;

    default:
      return item.title || item.name;
  }

  /*
  let emo = ' ';
  switch (item.status) {
    case '1':
      emo = '✔︎';
      break;
    case '2':
      emo = '✘';
      break;
    default:
      emo = '❏';
  }
 
  return emo + ' ' + item.name;
   */
}

/*
  {title:’DT1 Датчик температуры.value (значение)’, // Для показа в окне
    link:’modbus1.ch_1’, // Можно назвать более абстрактно, это нужно будет передавать при запросе devlcelink (например, selected?)
    dialognodeid:’d0772’. // id  узла в дереве диалога 
    fieldvalue:’d0772.value’ // Поле для отправки на сервер
    */

function createIdsInFilter(arr) {
  const filter = {};
  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
  }
  return filter;
}

module.exports = {
  isExfieldtype,
  getEmptyValue,
  getList,
  getDeviceTitle,
  getSceneTitle,
  getDroplist,
  getDroplistItem,
  chooseTreeItemComponent,
  createIdsInFilter,
  loadList,
  showHandlersForType
};
