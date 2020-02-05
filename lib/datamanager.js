/**
 *  datamanager.js
 * 
 *  Слой работы с данными (не историческими)
 *  Описание структур данных Data Description Object - ddo.js
 *  Типы данных определяются интерфейсом:
 *     menu (статические объекты), table (таблицы данных), tree (деревья)
 *     Внутри типа - идентификатор конкретной сущности (имя дерева, меню, таблицы)
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('./appconfig');
const hut = require('./utils/hut');

const dbstore = require('./dbs/dbstore');
const cache = require('./dbs/cache');
const treeutil = require('./utils/treeutil');

// Описание данных
const cdo = require('./dbs/cdo');
const descObj = require('./dbs/ddo');

const clearCacheUpdates = {};

/**
 *
 * @param {*} type
 * @param {*} id
 */
async function start() {
  //
  dbstore.start(
    Object.keys(cdo).map(name => ({ name, filename: appconfig.get(cdo[name].folder) + '/' + name + '.db' }))
  );

  // Для элементов table - Создать корневые записи для иерархических справочников в lists
  if (descObj.table) {
    await checkAndCreateListsRootNodes();
  }

  // Для элементов tree
  // Обработка descObj - создать propremap из propmap
  // Построить таблицу для инвалидации кэша при редактировании таблиц clearCacheUpdates
  if (descObj.tree) {
    Object.keys(descObj.tree).forEach(name => {
      if (typeof descObj.tree[name] == 'object' && descObj.tree[name].branch) {
        const descItem = descObj.tree[name];
        addPropReMap(descItem.branch);
        addPropReMap(descItem.leaf);

        if (descItem.branch.table) addClearCacheUpdates(descItem.branch.table, name);
        if (descItem.leaf.table) addClearCacheUpdates(descItem.leaf.table, name);
      }
    });
  }
}

async function checkAndCreateListsRootNodes() {
  const data = await dbstore.get('lists', { parent: 0 });
  // Вывернуть свойством list наружу
  const found = hut.arrayToObject(data, 'list');

  const docsToWrite = [];
  Object.keys(descObj.table).forEach(table => {
    if (descObj.table[table].collection == 'lists' && !found[table]) {
      const name = descObj.table[table].defRootTitle || 'All ';
      docsToWrite.push({ _id: table, list: table, parent: 0, order: 0, name });
    }
  });
  if (docsToWrite.length > 0) {
    console.log('checkAndCreateListsRootNode');
    console.dir(docsToWrite);
    await dbstore.insert('lists', docsToWrite);
  } else {
    console.log('checkAndCreateListsRootNode: NO to write');
  }
}

function addPropReMap(obj) {
  if (obj && obj.propmap) {
    obj.propremap = {};
    Object.keys(obj.propmap).forEach(prop => {
      if (typeof obj.propmap[prop] == 'string') obj.propremap[obj.propmap[prop]] = prop;
    });
  }
}

function addClearCacheUpdates(table, id) {
  if (!clearCacheUpdates[table]) clearCacheUpdates[table] = [];
  clearCacheUpdates[table].push(getCacheKey('tree', id));
}

/**
 *  Получение данных для интерфейса по типу и имени (идентификатору):
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    Данные берутся из кэша или из dbstore
 *    Если в кэше нет - подгружаются в кэш
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор объекта
 * @return {Object}: {data, ts}
 */

async function get(type, id) {
  // Если данные кэшируются - сразу берем из кэша и выходим.
  //  Это могут быть одноузловые деревья, меню, системные таблицы, схемы??
  const key = getCacheKey(type, id);
  if (cache.has(key)) {
    console.log('FROM CACHE');
    return cache.get(key);
  }

  const desc = getDescItem(type, id);
  console.log('LOADING ' + util.inspect(desc));
  if (type == 'tree') return Array.isArray(desc) ? loadMultiTree(id) : loadTree(id);
  if (desc.store == 'db') return loadFromDb(desc);
  return loadSystem(type, id);
}

async function loadFromDb(desc) {
  const data = await dbstore.getData(desc);
  return { data, ts: Date.now() };
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
  const desc = getDescItem('tree', id);

  const promises = desc.map(treeId => {
    const key = getCacheKey('tree', treeId);
    return cache.has(key) ? Promise.resolve(cache.get(key)) : loadTree(treeId);
  });

  const results = await Promise.all(promises);
  let data = [];
  let ts = 0;
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });
  return { data, ts };
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
  const desc = getDescItem('tree', id);
  console.log('loadTree  ' + id);

  const b_desc = getDescItem('table', desc.branch.table);
  const l_desc = getDescItem('table', desc.leaf.table);
  console.log('loadTree  b_desc=' + util.inspect(b_desc));

  const dataArr = await Promise.all([
    dbstore.getData(Object.assign(b_desc, { order: 'order' })),
    dbstore.getData(l_desc)
  ]);

  // const data = buildTreeWithLeaves(desc, dataArr);
  const b_array = mapProps(dataArr[0], desc.branch);
  const l_array = mapProps(dataArr[1], desc.leaf);
  const data = treeutil.makeTreeWithLeaves(b_array, l_array);

  // TODO Должен быть один корневой элемент. Если есть потерянные - передвинуть в lost+found
  if (data.length > 1) {

  }

  // У корневого элемента прописать root - id дерева
  data[0].root = id;
  delete data[0].parent;

  // Сохранить результат в кэше
  const key = getCacheKey('tree', id);
  cache.set(key, data);
  return cache.get(key);
}

/**
 * Возвращает объект из системного файла данных
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор объекта
 * @return <Promise> {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function loadSystem(type, id) {
  const desc = getDescItem(type, id);

  if (!desc) throw { error: 'SOFTERR', message: `No desc for type:${type}, id:${id}` };

  const appdir = appconfig.get('appdir');

  const filename = path.resolve(appdir, desc.folder, desc.file + '.json');
  console.log('Load ' + filename);

  const buf = await fs.promises.readFile(filename, 'utf8');
  const data = JSON.parse(buf.toString());
  appconfig.translateSys(data);
  const key = getCacheKey(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function insert(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  if (desc.filter) {
    docsToWrite.forEach(item => hut.extend(item, desc.filter));
  }
  const res = await dbstore.insert(desc.collection, docsToWrite);

  if (keysToClear) keysToClear.forEach(key => cache.delete(key));
  return res;
}

async function update(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  // Здесь нужно создать filter и модификатор $set, если его нет
  // Если одна запись -  фильтр по _id
  // В любом случае внутри $set не д.б. _id??
  const filter = {};
  let docToUpdate;
  if (docsToWrite.length == 1) {
    filter._id = docsToWrite[0]._id;
    delete docsToWrite[0]._id;
    docToUpdate = { $set: docsToWrite[0] };
  }
  console.log('UPDATE ' + desc.collection + ' FILTER:');
  console.dir(filter);
  console.dir(docToUpdate);

  const res = await dbstore.update(desc.collection, filter, docToUpdate);

  // Сброс кэша после удачного сохранения
  console.log('keysToClear');
  console.dir(keysToClear);
  if (keysToClear) keysToClear.forEach(key => cache.delete(key));
}

function processBodyForUpdateMethods(body) {
  if (!body.payload) throw { error: 'ERRPAYLOAD', message: 'No payload!' };
  const data = Array.isArray(body.payload) ? body.payload : [body.payload];

  let desc = getUpdateDesc(body);
  let docsToWrite;
  let keysToClear;

  if (desc.store != 'db') {
    console.log('prev desc');
    console.dir(desc);
    docsToWrite = remapProps(data, desc.branch);
    keysToClear = clearCacheUpdates[desc.branch.table];

    // Найти таблицу для записи для деревьев
    desc = getDescItem('table', desc.branch.table);
    console.log('desc - desc.branch.table');
    console.dir(desc);
  } else {
    docsToWrite = data; // Преобразование полей делать не надо?
  }

  if (!desc.collection) throw { error: 'SOFTERR', message: 'Not found collection name for table=' + desc.table };
  return { desc, docsToWrite, keysToClear };
}

function getUpdateDesc(body) {
  const { type, id, options } = body;

  let partid = id; // optiond:{root:<id поддерева>
  if (options && options.root) partid = options.root;

  const desc = getDescItem(type, partid);
  if (Array.isArray(desc)) throw { error: 'ERRINSERT', message: 'Need options.root for composite tree!' };
  return desc;
}

/**
 *
 * @param {Array} data
 * @param {Object} descItem
 * @return {Array} - transformed data array
 */
function mapProps(data, { propmap, propext }) {
  return data.map(item => Object.assign({}, getMappedObj(item, propmap), propext));
}

function getMappedObj(obj, propmap) {
  const resobj = {};

  Object.keys(obj).forEach(prop => {
    if (propmap[prop] != undefined) resobj[propmap[prop]] = obj[prop];
  });
  return resobj;
}

/**
 *
 * @param {Array} data
 * @param {Object} descItem
 * @return {Array} - transformed data array
 */
function remapProps(data, { propremap }) {
  return data.map(item => Object.assign({}, getMappedObj(item, propremap)));
}

function getDescItem(type, id) {
  return descObj[type] && descObj[type][id] ? descObj[type][id] : '';
}

function getCacheKey(type, id) {
  return `${type}_${id}`;
}

module.exports = {
  start,
  get,
  loadTree,
  insert,
  update
};

/*
{
  "method": "insert",
  "type": "tree",
  "id":"devicesByPlace",
  "data":{"id":"77227722", "parent":"place", "title":"test"}
}

{"method":"get",
"type":"tree",
 "id":"devices"
}

{
  "method": "insert",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace"},
  "data":{"id":"77227799", "parent":"place", "title":"test 22", "order":10}
}
*/