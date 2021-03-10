/**
 *
 */
const util = require('util');

// const hut = require('../utils/hut');

const descriptor = require('../descriptor');
const appconfig = require('../appconfig');

const dataformer = require('./dataformer');
const datautil = require('./datautil');
const tagstore = require('./tagstore');

const xform = require('./xform');


async function get(query, user, holder) {
  const dm = holder.dm;
  const { method, type, id, nodeid } = query;
 
  // if (specreq.isSpecType(type)) return specreq.processSpec(query, dm, holder);
  if (dm.datagetter.isSpecType(type)) return dm.datagetter.processSpecType(query, holder);

  switch (method) {
    case 'get':
      if (!id) throw { error: 'ERRQUERY', message: 'Id not defined: ' + JSON.stringify(query) };
      if (type == 'form' && !nodeid) throw { error: 'ERRGET', message: 'nodeid not defined for method:get&type:form!' };
      return getData(query, holder);

    case 'getmeta':
      return getMeta(query, holder);

    default:
      throw { error: 'ERRGET', message: 'Unknown method: ' + method };
  }
}

async function getMeta(query, holder) {
  const dm = holder.dm;
  const data = await dm.getCachedData(query);
  return dm.datagetter.needFinishing(query) ? dm.datagetter.finishing(query, data, dm) : data;
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
  const dm = holder.dm;

  if (id == 'null') return {data:{}};
  if (type == 'log') return dm.datagetter.getLogData(query, holder);

  const desc = descriptor.getDescItem(type, id);
  // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
  if (desc.store == 'db') {
    const data = await dm.dbstore.getData(desc);
    return { data };
  }

  let data;
  switch (type) {
    // type=form'&id=formDeviceCommon&nodeid=xxxx
    case 'form':
      return dataformer.getRecordByForm(query, holder);

    case 'xform':
      data = dm.datagetter.getSpecData(query, holder);
      return getXFormData(id, data, holder);

    // type=droplist'&id=typeList
    case 'droplist':
      // return dm.datagetter.isSpec('droplist', id) ? dm.datagetter.getSpecData(query, holder) : dm.datagetter.getDroplist(id);
      return dm.datagetter.getDroplist(query, holder);

    case 'dict':
      return getDict(id, holder);

    case 'tags':
      return { data: tagstore.getList() };

    // type=tree'&id=dev
    case 'tree':
      if (Array.isArray(desc)) return getMultiTree(id, desc, holder);
      return dm.getCachedData(query, dataformer.getTree);

    case 'subtree':
      // return dm.datagetter.isSpec('subtree', id) ? dm.datagetter.getSpecData(query, holder) : dm.getCachedData(query, dataformer.getSubTree);
      return dm.getCachedData(query, dataformer.getSubTree);

    case 'popup':
      // return specreq.isSpecPopup(id) ? specreq.getSpecPopup(id, nodeid) : getPopup(id);

      return dm.datagetter.isSpec('popup', id) ? dm.datagetter.getSpecData(query, holder) : getPopup(id, holder);

    case 'menu':
      return dm.getSystemData({ type, id });

    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
  }
}



async function getDict(id, holder) {
  let res;
  res = appconfig.getDict(id);
  if (!res) res = await datautil.createDict(id, holder.dm);
  return { data: res };
}

async function getXFormData(id, indata, holder) {
  const meta = await holder.dm.getCachedData({ type: 'xform', id, method: 'getmeta' });

  const formMetaData = meta.data;
  const data = {};

  // Сформировать записи по ячейкам
  for (const cell of formMetaData.grid) {
    data[cell.id] = {};
    for (const item of formMetaData[cell.id]) {
      const getRes = indata && item.prop && indata[item.prop] ? indata[item.prop] : await xform.getData(item, holder);
      data[cell.id][item.prop] = getRes;
    }
  }
  return { data };
}

async function getPopup(id, holder) {
  let data = datautil.getPopupFromList(id);
  if (!data) {
    // popup может быть из tree или из droplist
    const dataObj = await dataformer.getCachedTree(id, holder.dm); // Возвращает 0 элемент
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
async function getMultiTree(id, desc, holder) {
  // const desc = descriptor.getDescItem('tree', id);

  // result = await dm.getCachedData({type, id, nodeid}, dataformer.getTree);

  const promises = desc.map(treeId => holder.dm.getCachedData({ type: 'tree', id: treeId }, dataformer.getTree));

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
