/**
 *
 */
// const util = require('util');

// const hut = require('../utils/hut');

const descriptor = require('../descriptor');
const dm = require('../datamanager');

const appconfig = require('../appconfig');
const dataformer = require('./dataformer');
const datautil = require('./datautil');
const tagstore = require('./tagstore');

const xform = require('./xform');

const specreq = require('../appspec/specreq');
const pluginpopup = require('../plugin/pluginpopup');

const SPEC = ['link'];

async function get(query, user, holder) {
  const { method, type, id, nodeid } = query;

  if (SPEC.includes(type)) return specreq.processSpec(query, dm, holder);

  switch (method) {
    case 'get':
      if (!id) throw { error: 'ERRQUERY', message: 'Id not defined: ' + JSON.stringify(query) };
      if (type == 'form' && !nodeid) throw { error: 'ERRGET', message: 'nodeid not defined for method:get&type:form!' };
      return getData(query, holder);

    case 'getmeta':
      return dm.getCachedData(query);

    default:
      throw { error: 'ERRGET', message: 'Unknown method: ' + method };
  }
}

/**
 *  Получение данных по типу и идентификатору
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    После загрузки  сохраняются в кэше
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор по типу объекта
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос

 * @return {Object}: {data}
 */
// async function get(query, holder) {
async function getData(query, holder) {
  const { type, id, nodeid } = query;

  const desc = descriptor.getDescItem(type, id);
  // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
  if (desc.store == 'db') {
    const data = await dm.dbstore.getData(desc);
    return { data };
  }

  switch (type) {
    // type=form'&id=formDeviceCommon&nodeid=xxxx
    case 'form':
      return dataformer.getRecordByForm(query, holder);

    case 'xform':
      return getXFormData(id, nodeid);

    // type=droplist'&id=typeList
    case 'droplist':
      return datautil.getDroplist(id);
    case 'dict':
      return getDict(id);

    case 'tags':
      return { data: tagstore.getList() };

    // type=tree'&id=dev
    case 'tree':
      if (Array.isArray(desc)) return getMultiTree(id, desc);
      return dm.getCachedData(query, dataformer.getTree);

    case 'subtree':
      return dm.getCachedData(query, dataformer.getSubTree);

    case 'popup':
      return id.startsWith('plugin')
        ? pluginpopup.getPopupPlugin(id, nodeid)
        : id.startsWith('dyn_')
        ? getDynPopup(id, nodeid)
        : getPopup(id);

    case 'menu':
      return dm.getSystemData({ type, id });

    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
  }
}

async function getDynPopup(id, nodeid) {
  return [];
}

async function getDict(id) {
  let res;
  res = appconfig.getDict(id);
  if (!res) res = await datautil.getDict(id);
  return { data: res };
}

// async function getXFormData(id, nodeid) {
async function getXFormData(id) {
  const meta = await dm.getCachedData({ type: 'xform', id, method: 'getmeta' });

  const formMetaData = meta.data;
  const data = {};

  // Сформировать записи по ячейкам
  for (const cell of formMetaData.grid) {
    data[cell.id] = {};
    for (const item of formMetaData[cell.id]) {
      const getRes = await xform.getData(item);
      data[cell.id][item.prop] = getRes;
    }
  }
  return { data };
}

async function getPopup(id) {
  let data = datautil.getPopupFromList(id);
  if (!data) {
    // popup может быть из tree или из droplist
    const dataObj = await dataformer.getCachedTree(id); // Возвращает 0 элемент
    data = dataObj.children;
  }
  return { data };
  // return { data: dataObj.children };
}

/**
 * Возвращает объект с деревом, составленным из нескольких деревьев (несколько node с parent=0)
 *
 * @param {String} id - идентификатор дерева
 * @return {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]},
 *           {"id":22,"title":"Компоненты","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function getMultiTree(id, desc) {
  // const desc = descriptor.getDescItem('tree', id);

  // result = await dm.getCachedData({type, id, nodeid}, dataformer.getTree);

  const promises = desc.map(treeId => dm.getCachedData({ type: 'tree', id: treeId }, dataformer.getTree));

  const results = await Promise.all(promises);
  let data = [];
  let ts = 0;
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });

  return { data };
}

module.exports = {
  get
};
