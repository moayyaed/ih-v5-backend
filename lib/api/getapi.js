/**
 *
 */
const util = require('util');

// const hut = require('../utils/hut');

const descriptor = require('../descriptor');
const appconfig = require('../appconfig');

const formdataGet = require('../apptools/formdataGet');
const datautil = require('../apptools/datautil');
const tagstore = require('../dbs/tagstore');
const loadsys = require('../utils/loadsys');

const linkmethods = require('../domain/linkmethods');

const xform = require('./xform');

async function get(query, user, holder) {
  const { method, type, id, nodeid } = query;
  if (type == 'link') return processLink(query, holder);

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
 *  Обработка запросов для type:link
 *
 * @param {Object} query - объект запроса
 *
 * @return {Object}: {data}
 */
async function processLink(query, holder) {
  const apiFun = linkmethods[query.method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unexpected type or method for type:link' };
  return apiFun(query, holder);
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
async function getData(query, holder) {

  const { type, id } = query;
  const dm = holder.dm;

  if (id == 'null') return { data: {} };
  if (type == 'journal') return dm.datagetter.getLogData(query, holder);
  if (type == 'alertlog') return dm.datagetter.getAlertLogData(query, holder);
  if (type == 'table') return dm.datagetter.getTable(query, holder); // получить напрямую данные таблицы

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
      return formdataGet(query, holder);

    case 'xform':
      data = await dm.datagetter.getSpecData(query, holder);
      return getXFormData(id, data, holder);

    // type=droplist'&id=typeList
    case 'droplist':
      return dm.datagetter.getDroplist(query, holder.dm);

    case 'dict':
      return getDict(id, holder);

    case 'tags':
      return { data: tagstore.getList() };

    // type=tree'&id=dev
    case 'tree':
      if (Array.isArray(desc)) {
        const res = await getMultiTree(id, desc, holder);
        return {data:res};
      }
      return {data: [await dm.getCachedTree(query)]};
      // return dm.getCachedData(query, dataformer.getTree);

    case 'subtree':
      // return dm.datagetter.isSpec('subtree', id) ? dm.datagetter.getSpecData(query, holder) : dm.getCachedData(query, dataformer.getSubTree);
      return { data: await dm.getCachedSubTree(query)};
      // return dm.getCachedData(query, dataformer.getSubTree);

    case 'popup':
      return dm.datagetter.isSpec('popup', id) ? dm.datagetter.getSpecData(query, holder) : getPopup(id, holder);

    case 'menu':
      return query.id == 'pmmenu' ? getPMmenu(query, holder) : dm.getSystemData(query);

    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
  }
}

async function getPMmenu(query, holder) {
  // pmmenu получить из кэша (или сохранить в кэше) с учетом установленных модулей
  const key = 'menu_pmmenu_base'; // Сохранить не с ключом 'menu_pmmenu', чтобы сразу из кэша не бралось
  let data;
  if (holder.dm.cache.has(key)) {
    data = holder.dm.cache.getData(key);
  } else {
    data = await loadsys.loadSystemData('menu', 'pmmenu');
    // Проверить наличие модулей;
    for (let i = data.length - 1; i >= 0; i--) {
      const section = data[i].route;
      if (section && appconfig.disSection(section)) {
        data.splice(i, 1);
      }
    }
    holder.dm.cache.set(key, data);
  }

  // Ограниченный доступ для user - показать только пункту из pmparts
  // pmpartsAccess = { all_pmparts: 2 }; // все
  // pmpartsAccess = { pmparts: Set { 'access', 'database' } }
  // pmpartsAccess = {} // нет доступа
  const pmpartsAccess = holder.am.getUserPMParts(query.userId); // {all_pmparts:2, pmparts:{}}
  if (pmpartsAccess.all_pmparts == 2) return { data };

  const selParts = [];
  if (pmpartsAccess.pmparts) {
    data.forEach(item => {
      if (item.route && pmpartsAccess.pmparts.has(item.route)) {
        selParts.push(item);
      }
    });
  }
  return { data: selParts };
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
    // const dataObj = await dataformer.getCachedTree(id, holder.dm); // Возвращает 0 элемент
    const dataObj = await holder.dm.getCachedTree({id}); // Возвращает 0 элемент
    data = dataObj.children;
  }
  return { data };
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

  // const promises = desc.map(treeId => holder.dm.getCachedData({ type: 'tree', id: treeId }, dataformer.getTree));
  const promises = desc.map(treeId => holder.dm.getCachedTree( {id:treeId}));

  const results = await Promise.all(promises);
  /*
  let data = [];
  let ts = 0;
  console.log('getMultiTree results = '+util.inspect(results))
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });
  */

  return results;
}

module.exports = {
  get
};
