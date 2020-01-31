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

const appconfig = require('../appconfig');

const descObj = require('./ddo');
const dbstore = require('./dbstore');
const cache = require('./cache');

const treeutil = require('../utils/treeutil');



const appdir = appconfig.get('appdir');

/**
 *  Получение динамических данных для интерфейса по типу и имени (идентификатору):
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    Данные берутся из кэша или из dbstore
 *    Если в кэше нет - подгружаются в кэш
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор объекта
 * @return <Promise> {Object}: {data, ts}
 */

function get(type, id) {
  // Если данные кэшируются - сразу берем из кэша и выходим.
  //  Это могут быть одноузловые деревья, меню, системные таблицы, схемы??
  const key = getCacheKey(type, id);
  if (cache.has(key)) {
    console.log('FROM CACHE');
    return Promise.resolve(cache.get(key));
  }

  console.log('LOADING');
  switch (type) {
    case 'tree':
      return Array.isArray(getDescItem(type, id)) ? loadMultiTree(id) : loadTree(id);
    case 'table':
      return loadTable(type, id);
    case 'menu':
      return loadSystem(type, id);
    default:
  }
}

/**
 * Возвращает объект с деревом, составленным из нескольких деревьев (несколько node с parent=0)
 *
 * @param {String} id - идентификатор дерева
 * @return <Promise> {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]},
 *           {"id":22,"title":"Компоненты","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
function loadMultiTree(id) {
  const desc = getDescItem('tree', id);

  let promises = desc.map(treeId => {
    const key = getCacheKey('tree', treeId);
    return cache.has(key) ? Promise.resolve(cache.get(key)) : loadTree( treeId);
  });

  return new Promise(resolve => {
    Promise.all(promises).then(resuts => {
      let data = [];
      let ts = 0;
      resuts.forEach(cacheItem => {
        data = data.concat(cacheItem.data);
        if (cacheItem.ts > ts) ts = cacheItem.ts;
      });
      resolve({ data, ts });
    });
  });
}

/**
 * Возвращает объект с деревом (одно дерево)
 *    Данные берутся из таблиц
 *    Дерево также сохраняется в кэш
 * @param {String} id - идентификатор дерева
 * @return <Promise> {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
function loadTree(id) {
  const desc = getDescItem('tree', id);

  return new Promise((resolve, reject) => {
    Promise.all([dbstore.getData({ table: desc.branch.table }), dbstore.getData({ table: desc.leaf.table })])
      .then(dataArr => {
        // Сохранить результат в кэше
        const data = treeutil.buildTreeWithLeaves(desc, dataArr);
        const key = getCacheKey('tree', id);
        cache.set(key, data);
        resolve(cache.get(key));
      })
      .catch(e => {
        reject(e);
      });
  });
}

function loadTable(type, id) {
  const desc = getDescItem(type, id);
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
function loadSystem(type, id) {
  const desc = getDescItem(type, id);

  return new Promise((resolve, reject) => {
    if (!desc) reject({ error: 'SOFTERR', message: 'LOADING ERROR' });

    const filename = path.resolve(appdir, desc.folder, desc.file + '.json');
    console.log('Load ' + filename);

    fs.promises
      .readFile(filename, 'utf8')
      .then(buf => {
        const data = JSON.parse(buf.toString());
        appconfig.translateSys(data);
        const key = getCacheKey(type, id);
        cache.set(key, data);
        resolve(cache.get(key));
      })
      .catch(e => {
        console.log('reject ' + util.inspect(e));
        reject(e);
      });
  });
}

function find() {}

function addItem() {}

function deleteItem() {}

function updateItem() {}

function getDescItem(type, id) {
  return descObj[type] && descObj[type][id] ? descObj[type][id] : '';
}

function getCacheKey(type, id) {
  return `${type}_${id}`;
}

module.exports = {
  get,
  loadTree,
  find,
  addItem,
  deleteItem,
  updateItem
};
