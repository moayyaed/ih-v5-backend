/**
 *
 * Утилиты работы с данными - не прикладной уровень
 *
 */

const util = require('util');

const hut = require('../utils/hut');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

const liststore = require('../dbs/liststore');
const treeguide = require('./treeguide');

const datagetter = require('../appspec/datagetter');

const exfieldtypeList = ['code', 'script', 'layout', 'container', 'template'];

function isExfieldtype(type) {
  return exfieldtypeList.includes(type);
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

  if (listname == 'handlers') {
    return getHandlerList();
  }

  if (liststore.hasList(listname)) {
    liststore.getListAsArray(listname).forEach(item => {
      if (!item.folder) {
        res.push({ id: item.id, title: datagetter.formTitle(listname, item) });
      }
    });
  }
  return { data: res };
}

function getPopupFromList(listname) {
  if (liststore.hasList(listname)) {
    return liststore.getListAsArray(listname);
  }
}

function getHandlerList() {
  const res = [{ id: '-', title: '' }];
  liststore.getListAsArray('handlerList').forEach(item => {
    console.log('getHandlerList ' + util.inspect(item));
    res.push({ id: item.id, title: item.title || item.name, hide: getHideForHandlerType(hut.allTrim(item.type)) });
  });
  return { data: res };
}

function getHideForHandlerType(type) {
  switch (type) {
    case 'calculate':
      return "data.op.id != 'calc'";
    case 'command':
      return "data.op.id != 'cmd'";
    default:
      return "data.op.id == 'calc' || data.op.id == 'cmd'";
  }
}

function getDroplistItemFromList(listname, key) {
  const item = liststore.getItemFromList(listname, key);
  return item ? { id: item.id, title: datagetter.formTitle(listname, item) } : { id: '-', title: '-' };
}

async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };
  return loadList(id);
}

async function getListItem(listname, key) {
  return liststore.getItemFromList(listname, key);
}

function existsListItem(listname, key) {
  const item = liststore.getItemFromList(listname, key);
  return item && item.id == key;
}

// Словарь делается из таблицы
async function getDict(id) {
  const desc = descriptor.getTableDesc(id);
  if (!desc) throw { error: 'SOFTERR', message: 'Not found table for dict creation: ' + id };

  const data = await dm.dbstore.get(desc.collection, {});

  const res = {};
  let key = 'id';
  let val = 'title';

  if (id == 'localList' || 'globalList') {
    key = 'dn';
    val = 'defval';
  }
  data.forEach(item => {
    res[item[key]] = item[val];
  });

  return res;
}

function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';
  return getDroplistItemFromList(listdata, key);
}

function isLink(nodeid) {
  return nodeid && nodeid.indexOf('.') > 0;
}

function isNewRecord(id) {
  return id && id.startsWith('__new');
}

function getPathFromTree(treeId, nodeId, topNodeId) {
  return treeguide.getPath(treeId, nodeId, topNodeId);
}

module.exports = {
  isExfieldtype,
  getEmptyValue,
  getList,
  getDict,
  getListItem,
  existsListItem,
  getDroplist,
  getDroplistItem,
  loadList,
  isLink,
  isNewRecord,
  getPathFromTree,
  getPopupFromList,
  getDroplistItemFromList
};
