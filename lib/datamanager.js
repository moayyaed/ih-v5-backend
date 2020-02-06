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
const descriptor = require('./dbs/descriptor');
const cache = require('./dbs/cache');

// const validator = require('./dbs/validator');
const treeutil = require('./utils/treeutil');

// Описание данных
const cdo = require('./dbs/cdo');
const ddo = require('./dbs/ddo');


let clearCacheUpdates;

/**
 *
 */
async function start() {
  //
  dbstore.start(
    Object.keys(cdo).map(name => ({ name, filename: appconfig.get(cdo[name].folder) + '/' + name + '.db' }))
  );

  descriptor.start(ddo);

  // Построить таблицу для инвалидации кэша при редактировании таблиц clearCacheUpdates
  clearCacheUpdates = descriptor.getTreeCacheInvalidate();

  // Для элементов table - Создать корневые записи для иерархических справочников в lists
  await checkAndCreateListsRootNodes();
}

/**
 *
 */
async function checkAndCreateListsRootNodes() {
  const data = await dbstore.get('lists', { parent: 0 });
  // Вывернуть свойством list наружу
  const found = hut.arrayToObject(data, 'list');

  const docsToWrite = descriptor.findNonexistentListsRootNodes(found);
  if (docsToWrite.length > 0) {
    await dbstore.insert('lists', docsToWrite);
  }
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
  const key = descriptor.getCacheKey(type, id);
  if (cache.has(key)) {
    return cache.get(key);
  }

  const desc = descriptor.getDescItem(type, id);
  console.log('LOADING ' + util.inspect(desc));
  if (type == 'tree') return Array.isArray(desc) ? loadMultiTree(id) : loadTree(id);
  if (desc.store == 'db') return loadFromDb(desc);
  return loadSystem(type, id);
}

async function getMeta(type, id) {
  const key = descriptor.getMetaCacheKey(type, id);
  return cache.has(key) ? cache.get(key) : loadMeta(type, id);
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
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = descriptor.getDescItem('table', desc.leaf.table);

  const dataArr = await Promise.all([
    dbstore.getData(Object.assign(b_desc, { order: 'order' })),
    dbstore.getData(Object.assign(l_desc, { order: 'order' }))
  ]);

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap, desc.branch.propext);
  const l_array = hut.mapProps(dataArr[1], desc.leaf.propmap, desc.leaf.propext);
  let data = treeutil.makeTreeWithLeaves(b_array, l_array);

  // TODO Должен быть один корневой элемент. Если есть потерянные - передвинуть в lost+found
  if (data.length > 1) {
    treeutil.moveToLost(data, id);
  }

  // У корневого элемента прописать root - id дерева
  data[0].root = id;
  delete data[0].parent;
  delete data[0].list;

  // Сохранить результат в кэше
  const key = descriptor.getCacheKey('tree', id);
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
  const desc = descriptor.getDescItem(type, id);
  if (!desc) throw { error: 'SOFTERR', message: `No desc for type:${type}, id:${id}` };

  const filename = path.resolve(appconfig.get('appdir'), desc.folder, desc.file + '.json');  
  const data = await loadAndTranslateJsonFile(filename);

  const key = descriptor.getCacheKey(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function loadMeta(type, id) {
  let filename = path.resolve(appconfig.get('sysbasepath'), 'meta', type + '_' + id + '.json');
  const data = await loadAndTranslateJsonFile(filename);

  const key = descriptor.getMetaCacheKey(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function loadAndTranslateJsonFile(filename) {
  console.log('Load ' + filename);
  const buf = await fs.promises.readFile(filename, 'utf8');
  const data = JSON.parse(buf.toString());
  appconfig.translateSys(data);
  return data;
}

async function insert(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  if (desc.filter) {
    docsToWrite.forEach(item => hut.extend(item, desc.filter));
  }

  // Для дерева нужно проверить, что parent существует
  if (body.type == 'tree') {
    await checkParentBranch(body, true);
  }
  const res = await dbstore.insert(desc.collection, docsToWrite);

  if (keysToClear) keysToClear.forEach(key => cache.delete(key));
  return res;
}

async function update(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  // Для дерева нужно проверить, что parent существует в branch таблице
  if (body.type == 'tree') {
    await checkParentBranch(body, false);
  }

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

  const res = await dbstore.update(desc.collection, filter, docToUpdate);

  // Сброс кэша после удачного сохранения
  if (keysToClear) keysToClear.forEach(key => cache.delete(key));
}

/**
 */

async function remove(body) {
  console.log('REMOVE');
  console.dir(body);

  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  let numRemoved;
  if (body.options && body.options.leaf) {
    // Удаление листа (листьев)
    const arr = docsToWrite.filter(item => item._id).map(item => item._id);
    if (!arr.length) throw { error: 'ERRREMOVE', message: 'Expected "id" prop in payload!' };
    numRemoved = await removeLeaves(arr, desc.collection);
  } else {
    // Если это ветка - нужно найти все внутренние ветки и листья!
    // Это делаем в кэше дерева
    // Если нет - создать
    // const treeId =

    const key = descriptor.getCacheKey('tree', treeId);
    return cache.has(key) ? Promise.resolve(cache.get(key)) : loadTree(treeId);
  }

  // Сброс кэша после сохранения
  if (keysToClear) keysToClear.forEach(key => cache.delete(key));

  console.log('numRemoved ' + numRemoved);
  // Возможно это должен быть warning!!
  // if (numRemoved != arr.length)  throw {error:'ERRREMOVE', message:`Only ${numRemoved} out of ${arr.length} items have been deleted!`};
}

async function removeLeaves(arr, collection) {
  const filter = {};
  let multi = false;

  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
    multi = true;
  }
  //
  return dbstore.remove(collection, filter, { multi });
}

/**
 * Проверка, что ветка parent существует
 * @param {Object} body
 * @param {Object} doc
 * @param {Bool} needParent
 */
async function checkParentBranch(body, needParent) {
  const desc = descriptor.getUpdateDesc(body);
  const table = desc.branch.table;

  if (!table) throw { error: 'SOFTERR', message: `No table prop for tree branch ${body.id}` };
  const tableDesc = descriptor.getDescItem('table', table);

  const payload = body.payload;
  // if (Array.isArray(doc)) {
  // Для массива нужен Promise.all
  // } else
  const doc = Array.isArray(payload) ? payload[0] : payload;

  if (needParent || doc.parent != undefined) {
    if (!doc.parent) throw { error: 'ERRPAYLOAD', message: 'Parent field must be non-zero!' };

    const filter = Object.assign({}, tableDesc.filter || {}, { _id: doc.parent });
    const result = await dbstore.get(tableDesc.collection, filter);
    if (!result || !result.length) {
      throw {
        error: 'ERRNOPARENT',
        message: `Parent record not exists! Collection "${tableDesc.collection}" filter: ${JSON.stringify(filter)}`
      };
    }
  }
}

/**
 * Проверяет и разбирает запрос на редактирование
 *
 * @param {*} body
 * @return {Object} - {
 *    desc {Object} - объект описания таблицы, которая будет редактироваться
 *    docsToWrite {Object} - документы на запись, пропущенные при необходимости через remap
 *    keysToClear {Array} - массив ключей кэша, данные которых изменятся в результате операции
 *  }
 */
function processBodyForUpdateMethods(body) {
  if (!body.payload) throw { error: 'ERRPAYLOAD', message: 'No payload!' };
  const data = Array.isArray(body.payload) ? body.payload : [body.payload];

  let desc = descriptor.getUpdateDesc(body);
  if (Array.isArray(desc)) throw { error: 'ERRINSERT', message: 'Need options.root for composite tree!' };

  let docsToWrite;
  let keysToClear;

  if (body.type == 'tree') {
    const branchOrLeaf = body.options && body.options.leaf ? 'leaf' : 'branch';
    const table = desc[branchOrLeaf] && desc[branchOrLeaf].table ? desc[branchOrLeaf].table : '';
    if (!table) throw { error: 'SOFTERR', message: `No table prop for tree ${branchOrLeaf} ${body.id}` };

    docsToWrite = hut.mapProps(data, desc[branchOrLeaf].propremap);
    keysToClear = clearCacheUpdates[table];

    desc = descriptor.getDescItem('table', table);
  } else {
    // Преобразование полей делать не надо?
    docsToWrite = data;
  }

  if (!desc.collection) throw { error: 'SOFTERR', message: 'Not found collection name for table=' + desc.table };
  return { desc, docsToWrite, keysToClear };
}

module.exports = {
  start,
  get,
  getMeta,
  insert,
  update,
  remove,
  loadTree // только для тестирования
};

/*

{"method":"get",
"type":"tree",
 "id":"devices"
}

{
  "method": "insert",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace"},
  "payload":{"id":"77227799", "parent":"place", "title":"test 22", "order":10}
}

{
  "method": "update",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace"},
  "payload":{"id":"place", "title":"Все устройства"}
}
{
  "method": "update",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227788", "title":"VERY Big device", "order":150}
}

{
  "method": "insert",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227700", "parent":"p2", "title":"New device in p2", "order":100}
}

{"method":"remove",
"type":"tree",
 "id":"devices",
 "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227788",  "order":150}
}
*/
