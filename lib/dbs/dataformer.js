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
const treeguide = require('./treeguide');

function start() {
  cache.start();
  treeguide.start();
}

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
async function get(type, id, nodeid) {
  // Если данные кэшируются - сразу берем из кэша.
  const key = descriptor.getCacheKey(type, id);
  if (cache.has(key)) return cache.get(key);

  switch (type) {
    // type=form'&id=formDeviceCommon&nodeid=xxxx
    case 'form':
      return getRecordByForm(id, nodeid);

    // type=droplist'&id=typeList
    case 'droplist':
      return datautil.getList(id);

    case 'tags':
      return { data: tagmanager.getList() };

    // type=tree'&id=dev
    case 'tree':
      return getTree(id);

    default:
      return getSystemData(type, id);
  }
}

async function getMeta(type, id) {
  const key = descriptor.getCacheKey(type, id, 'meta');
  if (cache.has(key)) return cache.get(key);

  const data = await loadsys.loadMeta(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function getTree(id) {
  const desc = descriptor.getDescItem('tree', id);
  return Array.isArray(desc) ? getMultiTree(id) : loadTree(id);
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

    if (formMetaData.breadcrumbs && formMetaData.breadcrumbs.tree) {
      const treeId = formMetaData.breadcrumbs.tree;
      // Проверить, что дерево загружено. Если нет - загрузить
      if (!treeguide.get(treeId)) {
        await loadTree(treeId);
      }

      data.breadcrumbs = await treeguide.getBreadcrumbs(treeId, nodeid);
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);
        dataFromTable[cell.table] = await dbstore.get(desc.collection, { _id: nodeid });
      }
    }

    // console.log('dataFromTable =' + util.inspect(dataFromTable));

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
async function getMultiTree(id) {
  const desc = descriptor.getDescItem('tree', id);

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

  // Создать treeguide заново
  treeguide.create(id, b_array, l_array, desc);

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);
  if (data.length > 1) {
    const lostNode = treeutil.moveToLost(data, id);

    // Записать в корень дерева как последний children
    data[0].children.push(lostNode);

    // Изменить в treeguide

    treeguide.addItem(id, lostNode.id, { title: lostNode.title, parent: data[0].id, component: lostNode.component });

    lostNode.children.forEach(item => {
      treeguide.updateItem(id, item.id, { parent: lostNode.id });
    });
  }

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
 * Сформировать вспомогательный объект для разбора формы и сохранить в кэш
 * @param {String} id - ид-р формы
 * @return {Object} Объект для разбора формы:
 * {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     }
   }
 */
async function getMetaUpForm(id) {
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) return cache.get(key).data;

  const metaData = await getMeta('form', id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];
  const alloc = {}; // table->prop->cell

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (cell.table) {
      records.push({ cell: cell.id, table: cell.table });
      addAlloc(cell.table, formMetaData[cell.id], cell.id);
    }

    // может быть компонент-таблица
    if (formMetaData[cell.id]) {
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: cell.table, prop: item.prop });
          addAlloc(item.prop, item.columns, cell.id);
        }
      });
    }
  }

  // Сохранить в кэш
  cache.set(key, { records, tables, alloc });
  return cache.get(key).data;

  function addAlloc(table, arr, cellid) {
    if (!alloc[table]) alloc[table] = {};

    arr.forEach(item => {
      if (item.type != 'table') {
        alloc[table][item.prop] = cellid;
      }
    });
  }
}

function invalidateCacheForRequest(body) {
  if (!body || !body.type || !body.payload) return;

  // body = {method:insert, type:tree, id:dev, payload:{devices:{folders:[], nodes:[]}}}
  const payload = body.payload;
  let changedTables = [];
  if (body.type == 'tree') {
    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      if (payload[rootid].folders) {
        changedTables.push(desc.branch.table);
      }
      if (payload[rootid].nodes) {
        changedTables.push(desc.leaf.table);
      }
    }
  } else if (body.type == 'form') {
    // Имена таблиц вытащить из формы
    const tableSet = new Set();
    const key = descriptor.getCacheKey('form', body.id, 'meta');
    const cacheObj = cache.get(key);
    const formMetaData = cacheObj ? cacheObj.data : '';

    if (formMetaData && formMetaData.grid) {
      for (const cell of formMetaData.grid) {
        if (cell.table) tableSet.add(cell.table);
      }
      changedTables = Array.from(tableSet);
    }
  }

  changedTables.forEach(table => cache.invalidate(table));
}

function updateTreeguide(body, res) {
  console.log('updateTreeguide start res=' + util.inspect(res));

  if (!body || !body.type || !res || !Array.isArray(res) || !res.length) return;

  if (body.type == 'form') {
    // определить дерево для формы -  по breadcrumbs - НЕТ, может быть несколько деревьев завязано на таблицу?
    res.forEach(item => {
      if (item.table) {
        const trees = descriptor.getTreesForTable(item.table);
        console.log('trees='+trees.join(' '));
        trees.forEach(treeId => treeguide.updateItem(treeId, item.id, item))
      }
    });
    return;
  }

  if (body.type != 'tree' || !body.payload) return;

  const payload = body.payload;
  const method = body.method;

  for (const treeId in payload) {
    // treeId - имя дерева, одновременно несколько деревьев не редактируем ?
    res.forEach(item => {
      if (method == 'remove') {
        treeguide.deleteItem(treeId, item.id);
      } else {
        treeguide.updateItem(treeId, item.id, item);
        console.log('updateTreeguide ' + treeId + ' item=' + util.inspect(treeguide.getItem(treeId, item.id)));
      }
    });
  }
}


module.exports = {
  start,
  get,
  getMeta,
  getMetaUpForm,
  getTree,
  invalidateCacheForRequest,
  updateTreeguide
};
