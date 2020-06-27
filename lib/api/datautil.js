/**
 *
 * Утилиты работы с данными - не прикладной уровень
 *
 */

// const util = require('util');

const hut = require('../utils/hut');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

const liststore = require('../dbs/liststore');
const treeguide = require('./treeguide');

// const typestore = require('../device/typestore');

const datagetter = require('../appspec/datagetter');

const exfieldtypeList = ['code', 'layout', 'container', 'template'];

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

  // if (listname == 'readhandlers' || listname == 'writehandlers' || listname == 'commandhandlers') {
  if (listname.endsWith('handlers')) {
    return getHandlerLists(listname.substr(0, 1)); // oper=r,w,c
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


function getHandlerLists(oper) {
  const res = [{ id: '-', title: '' }];
  liststore.getListAsArray('handlerList').forEach(item => {
    // if (item.oper == oper) {
      res.push({ id: item.id, title: item.title || item.name });
    // }
  });
  return { data: res };
}

function getDroplistItemFromList(listname, key) {
  const item = liststore.getItemFromList(listname, key);
  return item ? { id: item.id, title: datagetter.formTitle(listname, item) } : { id: '-', title: '-' };
}

async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };
  return loadList(id);
}

function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';
  return getDroplistItemFromList(listdata, key);
}

function isLink(nodeid) {
  return nodeid && nodeid.indexOf('.')>0;
}

function isNewRecord(id) {
  return id && id.startsWith('__new');
}

function getPathFromTree(treeId, nodeId, topNodeId)  {
  return treeguide.getPath(treeId, nodeId, topNodeId);
}

module.exports = {
  isExfieldtype,
  getEmptyValue,
  getList,
  getDroplist,
  getDroplistItem,
  loadList,
  isLink,
  isNewRecord,
  getPathFromTree,
  getPopupFromList
};
