/**
 *  dyndata.js
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

const dbstore = require('./dbs/dbstore');
const cache = require('./dbs/cache');
const treeutil = require('./utils/treeutil');

// Описание данных
const cdo = require('./dbs/cdo');
const descObj = require('./dbs/ddo');

/**
 *
 * @param {*} type
 * @param {*} id
 */
function start() {
  //
  dbstore.start(
    Object.keys(cdo).map(name => ({ name, filename: appconfig.get(cdo[name].folder) + '/' + name + '.db' }))
  );
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
  console.log('loadTree  l_desc=' + util.inspect(l_desc));

  const dataArr = await Promise.all([dbstore.getData(b_desc), dbstore.getData(l_desc)]);

  // Сохранить результат в кэше
  const data = treeutil.buildTreeWithLeaves(desc, dataArr);
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

function find() {}

function addItem() {}

function deleteItem() {}

async function update(body) {
  const { type, id } = body;
  const desc = getDescItem(type, id);
  if (desc.store == 'db') return dbstore.update(desc, body);

  // TODO - пока меняю только таблицу, для дерева нужно определить таблицу для изменения
  throw { error: 'ERRUPDATE', message: 'Impossible to change the ' + type };
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
  find,
  addItem,
  deleteItem,
  update
};
