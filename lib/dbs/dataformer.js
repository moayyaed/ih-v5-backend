/**
 * dataformer.js
 * Загружает, формирует и кэширует данные
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');

const dbstore = require('../dbs/dbstore');
const descriptor = require('../dbs/descriptor');
const cache = require('../dbs/cache');
const loadsys = require('../dbs/loadsys');
const tabledata = require('../dbs/tabledataformer');
const datautil = require('../dbs/datautil');
const tagmanager = require('./tagstore');

/**
 *  Получение данных по типу и идентификатору
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    После загрузки  сохраняются в кэше
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор по типу объекта
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 * @param {String || Boolean} meta - флаг загрузки метаданных
 * @return {Object}: {data, ts}
 */
async function get(type, id, nodeid, meta) {
  console.log('FORM '+type+' '+id);
  if (meta) return getMeta(type, id);

  // Получить данные формы:  type=form'&id=formDeviceCommon&nodeid=xxxx
  if (type == 'form') return getRecordByForm(id, nodeid);

  // Получить droplist: type=droplist'&id=typeList
  if (type == 'droplist') return datautil.getList(id);
  if (type == 'tags') return {data:tagmanager.getList()};

  const desc = descriptor.getDescItem(type, id);

  // Получить дерево: type=tree'&id=dev
  if (type == 'tree') return Array.isArray(desc) ? loadMultiTree(id) : loadTree(id);

  return getSystemData(type, id);
}

async function getMeta(type, id) {
  const key = descriptor.getCacheKey(type, id, 'meta');
  if (cache.has(key)) {
    console.log('FROM cache ' + key);
    return cache.get(key);
  }

  const data = await loadsys.loadMeta(type, id);
  cache.set(key, data);
  return cache.get(key);
}

/**
 * Возвращает объект из системного файла данных
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор объекта
 *
 */
async function getSystemData(type, id) {
  const data = await loadsys.loadSystemData(type, id);
  const key = descriptor.getCacheKey(type, id);
  cache.set(key, data);
  return cache.get(key);
}

/**
 * Возвращает данные для формы
 *
 * @param {String} id - идентификатор формы
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 *
 */
async function getRecordByForm(id, nodeid) {
  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await getMeta('form', id);
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};

  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    if (formMetaData.breadcrumbs) data.breadcrumbs = await getBreadcrumbs(formMetaData.breadcrumbs, nodeid);

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);
        dataFromTable[cell.table] = await dbstore.get(desc.collection, { _id: nodeid });
      }
    }

    console.log('dataFromTable =' + util.inspect(dataFromTable));

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
          data[cell.id][item.prop] = await tabledata.get(dataFromTable, cell.table, nodeid, item.columns);
        
        } else if (cell.table && foundData(cell.table, item.prop)) {
          data[cell.id][item.prop] = await getData(cell.table, item);
        
        } else data[cell.id][item.prop] = datautil.getEmptyValue(item.type);
      }
    }
  } catch (e) {
    throw { error: 'SOFTERR', message: 'Unable prepare data for form ' + id + util.inspect(e) };
  }
  return { data };

  function foundData(table, prop) {
    return dataFromTable[table] && dataFromTable[table][0] && dataFromTable[table][0][prop] != undefined;
  }

  async function getData(table, item) {
    const val = dataFromTable[table][0][item.prop];
    if (item.type != 'droplist') return val;
    return datautil.getDroplistItem(item.data, val);
  }
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
async function loadMultiTree(id) {
  const desc = descriptor.getDescItem('tree', id);
  /*
  let data = [];
  let ts = 0;
 
  for (let treeId of desc) {
    const key = descriptor.getCacheKey('tree', treeId);
    if (!cache.has(key)) await loadTree(treeId);
    const cacheItem = cache.get(key);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
    data.push(cacheItem.data[0]);
  }
  */

  const promises = desc.map(treeId => {
    const key = descriptor.getCacheKey('tree', treeId);
    return cache.has(key) ? Promise.resolve(cache.get(key)) : loadTree(treeId);
  });

  const results = await Promise.all(promises);
  let data = [];
  let ts = 0;
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });

  return { data };
}

/**
 * Возвращает объект с деревом (одно дерево)
 *    Данные берутся из таблиц
 *    Дерево также сохраняется в кэш
 * @param {String} id - идентификатор дерева
 * @return {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function loadTree(id) {
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = descriptor.getDescItem('table', desc.leaf.table);

  const dataArr = await Promise.all([
    dbstore.getData(Object.assign({}, b_desc, { order: 'order', fields: hut.getFieldProjection(desc.branch.propmap) })),
    dbstore.getData(Object.assign({}, l_desc, { order: 'order', fields: hut.getFieldProjection(desc.leaf.propmap) }))
  ]);

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap);
  const l_array = hut.mapProps(dataArr[1], desc.leaf.propmap);

  // Создать tree_guide
  const tree_guide = createTreeGuide(b_array, l_array, desc);

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);
  if (data.length > 1) {
    const lostNode = treeutil.moveToLost(data, id);

    // Записать в корень дерева как последний children
    data[0].children.push(lostNode);

    // Изменить в tree_guide
    tree_guide[lostNode.id] = { id: lostNode.id, title: lostNode.title };
    lostNode.children.forEach(item => {
      if (tree_guide[item.id]) tree_guide[item.id].parent = lostNode.id;
    });
  }

  // Сохранить tree_guide в кэше
  cache.set(descriptor.getCacheKey('tree_guide', id), tree_guide);

  // У корневого элемента прописать root - id дерева
  data[0].root = id;
  delete data[0].parent;
  delete data[0].list;

  // TODO ??? Обойти все children и проверить порядок (зазор между order)
  // Если есть проблемы - выполнить сдвиг внутри children, изменения сохранить и записать в db???

  // Сохранить результат в кэше
  const key = descriptor.getCacheKey('tree', id);
  cache.set(key, data);
  return cache.get(key);
}

/**
 *
 * @param {*} treeId
 * @param {*} nodeId
 */
function createTreeGuide(b_array, l_array, desc) {
  const tree_guide = {};
  
  b_array.forEach(item => {
    tree_guide[item.id] = { id: item.id, title: item.title, parent: item.parent, table: desc.branch.table, component: '' };
  });
  l_array.forEach(item => {
    tree_guide[item.id] = { id: item.id, title: item.title, parent: item.parent, table: desc.leaf.table, component: '' };
  });
  return tree_guide;
}



/**
 *
 * @param {*} treeId
 * @param {*} nodeId
 */
async function getBreadcrumbs(breadcrumbsObj, nodeId) {
  const treeId = breadcrumbsObj.tree;

  // Получить метаданные дерева для опр defaultComponent-ов
  // const defComp = getTreeDefaultComponents(treeId);

  const key = descriptor.getCacheKey('tree_guide', treeId);
  if (!cache.has(key)) await loadTree(treeId);

  const cacheObj = cache.get(key);
  if (!cacheObj) return [];

  const tree_guide = cacheObj.data;
  const breadArr = [];
  let parent = nodeId;
  while (parent) {
    if (tree_guide[parent]) {
      breadArr.unshift({ id: parent, title: tree_guide[parent].title, component: '' });
      parent = tree_guide[parent].parent;
    } else parent = '';
  }
  return breadArr;
}


module.exports = {
  get,
  getMeta,
  loadTree
};
