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

const hut = require('./utils/hut');
const dbstore = require('./dbs/dbstore');
const descriptor = require('./dbs/descriptor');
const cache = require('./dbs/cache');
const loadsys = require('./dbs/loadsys');
const treeutil = require('./utils/treeutil');

let cacheInvalidateList;

/**
 *
 */
async function start() {
  // Запуск хранилища, передать ему список коллекций
  dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

  // Запуск объекта-дескриптора, передать ему описание деревьев и таблиц
  descriptor.start(
    loadsys.loadAndTranslateJsonFileSync('dbs', 'trees'),
    loadsys.loadAndTranslateJsonFileSync('dbs', 'tables')
  );

  // Построить таблицу для инвалидации кэша при редактировании таблиц cacheInvalidateList
  cacheInvalidateList = descriptor.getTreeCacheInvalidate();

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

  const docsToWrite = descriptor.createNonexistentListsRootNodes(found);
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
async function get(type, id, nodeid) {
  // Если данные кэшируются - сразу берем из кэша. Это могут быть одноузловые деревья, меню, системные таблицы
  const key = descriptor.getCacheKey(type, id);
  if (cache.has(key)) {
    return cache.get(key);
  }

  if (type == 'form') {
    // Форма записи таблицы  type=form'&id=formDeviceCommon&nodeid=xxxx
    return getRecordByForm(id, nodeid);
  }

  const desc = descriptor.getDescItem(type, id);
  console.log('LOADING ' + util.inspect(desc));
  if (type == 'tree') return Array.isArray(desc) ? loadMultiTree(id) : loadTree(id);
  if (desc.store == 'db') return loadFromDb(desc);
  return getSystemData(type, id);
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

async function getRecordByForm(id, nodeid) {
  const desc = descriptor.getFormDesc(id);
  if (!desc.table) throw { error: 'SOFTERR', message: 'Not found table for form:' + id };
  if (!desc.collection) throw { error: 'SOFTERR', message: 'Not found collection for form:' + id };

  // Нужно передать список полей как projection Список полей в форме!? Скорее всего, форма уже загружена
  if (!desc.fields) {
    const formMetaData = await getMeta('form', id);
    desc.fields = formMetaData.data.default || {};
  }

  const data = await dbstore.get(desc.collection, { _id: nodeid }, { fields: getFieldProjection(desc.fields) });
  console.log('FIELDS');
  console.dir(desc.fields);
  // Добавить поля, если их нет в таблице
  addMissingFields(data, desc.fields);
  return { data };
}

function addMissingFields(data, fields) {
  data.forEach(item => {
    Object.keys(fields).forEach(prop => {
      if (item[prop] == undefined) {
        if (typeof fields[prop] == 'object') {
          item[prop] = hut.clone(fields[prop]);
        } else item[prop] = fields[prop];
      }
    });
  });
}

async function getMeta(type, id) {
  const key = descriptor.getMetaCacheKey(type, id);
  if (cache.has(key)) return cache.get(key);

  const data = await loadsys.loadMeta(type, id);
  cache.set(key, data);
  return cache.get(key);
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
    dbstore.getData(Object.assign({}, b_desc, { order: 'order', fields: getFieldProjection(desc.branch.propmap) })),
    dbstore.getData(Object.assign({}, l_desc, { order: 'order', fields: getFieldProjection(desc.leaf.propmap) }))
  ]);

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap, desc.branch.propext);
  const l_array = hut.mapProps(dataArr[1], desc.leaf.propmap, desc.leaf.propext);
  let data = treeutil.makeTreeWithLeaves(b_array, l_array);

  if (data.length > 1) {
    treeutil.moveToLost(data, id);
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

function getFieldProjection(propmap) {
  const res = {};
  Object.keys(propmap).forEach(prop => {
    res[prop] = 1;
  });
  return res;
}

/**
 * Вставка одной или нескольких записей по запросу от API
 *  - добавляет в хранилище
 *  - в случае удачной операции удаляет кэши, связанные с этими данными
 * 
 * @param {Object} body:
    {
      "method": "insert",
      "type": "tree", // ||  "table"
      "id":"devices", // ид-р в ddo
      "options":{"root":"devicesByPlace", "leaf":true}, // leaf:Для дерева, root:Для дерева с несколькими корнями
      "payload":{"id":"77227799", "parent":"place1", "title":"Device 1", "order":10}
    } 
 * @return {Object} 
    {
      response:1,
      data:
    }
 */
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
  return { data: res };
}

/**
 * Изменение одной или нескольких записей по запросу от API
 *  - изменяет в хранилище
 *  - в случае удачной операции удаляет кэши, связанные с этими данными
 * 
 * @param {Object} body:
    {
      "method": "update",
      "type": "tree", // ||  "table"
      "id":"devices", // ид-р в ddo
      "options":{"root":"devicesByPlace", "leaf":false}, // leaf:Для дерева, root:Для дерева с несколькими корнями
      "payload":{"id":"77227799", "parent":"place",  "order":100}
    } 
 * @return {Object} 
    {
      response:1,
      data:
    }
 */
async function update(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  // Проверить, что изменяемые записи существуют
  const idSet = new Set();
  docsToWrite.forEach(doc => {
    idSet.add(doc._id);
  });
  if (!idSet.size) throw { error: 'ERRUPDATE', message: 'No records to update!' };

  checkRecordsExist(desc.collection, createIdsInFilter(Array.from(idSet)), idSet);

  // Для дерева нужно проверить, что parent существует в branch таблице
  if (body.type == 'tree') {
    await checkParentBranch(body, false);
  }

  // Изменить каждую отдельно!!? Так как здесь меняем по id
  for (const doc of docsToWrite) {
    await updateOne(desc.collection, doc);
  }

  // Сброс кэша после удачного сохранения
  if (keysToClear) keysToClear.forEach(key => cache.delete(key));
}

async function updateOne(collection, doc) {
  const filter = { _id: doc._id };
  delete doc._id;
  return dbstore.update(collection, filter, { $set: doc });
}

/**
 *
 */
async function remove(body) {
  const { desc, docsToWrite, keysToClear } = processBodyForUpdateMethods(body);

  let numRemoved = 0;
  const arr = docsToWrite.filter(item => item._id).map(item => item._id);
  if (!arr.length) throw { error: 'ERRREMOVE', message: 'Expected "id" prop in remove payload!' };

  if (body.type != 'tree' || (body.options && body.options.leaf)) {
    // Удаление простых записей таблицы или листа (листьев) дерева
    console.log('REMOVE leaf desc.collection=' + desc.collection);
    numRemoved = await removeItems(arr, desc.collection);
  } else {
    const id = arr[0];
    console.log('REMOVE branch ' + id);
    // Если это ветка - нужно найти все внутренние ветки и листья!
    // Это делаем в кэше дерева Если нет - создать
    const treeId = body.options && body.options.root ? body.options.root : body.id;
    const key = descriptor.getCacheKey('tree', treeId);

    const cachedObj = cache.has(key) ? cache.get(key) : await loadTree(treeId); // {data, ts}
    if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached Obj for key=' + key };

    const tree = cachedObj.data[0]; // Это массив, берем первый корень
    const { b_arr, l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, id);

    if (l_arr.length > 0) {
      // Удалить листья - сначала найти имя таблицы!!
      const table = descriptor.getTreeLeafDesc(treeId).table;
      const ldesc = descriptor.getDescItem('table', table);
      console.log('Remove leaves table=' + ldesc.collection + ' arr=' + l_arr.join(','));
      numRemoved += await removeItems(l_arr, ldesc.collection);
    }

    // Удалить ветки
    console.log('Remove branches table=' + desc.collection + ' arr=' + b_arr.join(','));
    numRemoved += await removeItems(b_arr, desc.collection);
  }

  // Сброс кэша после сохранения
  if (keysToClear) keysToClear.forEach(key => cache.delete(key));

  console.log('numRemoved ' + numRemoved);
  // Возможно это должен быть warning!!
  // if (numRemoved != arr.length)  throw {error:'ERRREMOVE', message:`Only ${numRemoved} out of ${arr.length} items have been deleted!`};
}

async function removeItems(arr, collection) {
  const filter = createIdsInFilter(arr);
  return dbstore.remove(collection, filter, { multi: arr.length > 1 });
}

function createIdsInFilter(arr) {
  const filter = {};
  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
  }
  return filter;
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

  // Проверить, что во всех записях есть parent и собрать их
  const docs = Array.isArray(body.payload) ? body.payload : [body.payload];

  const parentSet = new Set();
  docs.forEach(doc => {
    if (needParent || doc.parent != undefined) {
      if (!doc.parent) throw { error: 'ERRPAYLOAD', message: 'Id:' + doc.id + '. Parent field must be non-zero!' };
      parentSet.add(doc.parent);
    }
  });
  if (!parentSet.size) return;

  // Проверить, что parents есть в таблице
  const tableDesc = descriptor.getDescItem('table', table);

  // filter сформировать как in, если записей несколько
  const filter = createIdsInFilter(Array.from(parentSet));
  await checkRecordsExist(tableDesc.collection, filter, parentSet);
}

async function checkRecordsExist(collection, filter, idSet) {
  const result = await dbstore.get(collection, filter);

  // Не найдена ни одна запись
  if (!result) {
    throw {
      error: 'ERRNOPARENT',
      message: `Record not exists! Not found with filter:${JSON.stringify(filter)} in collection:${collection}`
    };
  }

  // Не найдена одна (несколько) из
  if (result.length != idSet.size) {
    // Найти, каких нет
    result.forEach(record => {
      if (idSet.has(record._id)) idSet.delete(record._id);
    });

    throw {
      error: 'ERRNOPARENT',
      message: `Record not exists! Not found record with _id:${Array.from(idSet).join(',')} in collection:${collection}`
    };
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
    keysToClear = cacheInvalidateList[table];

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

/api/admin?type=components&method=getmeta

/api/admin?type=menu&id=pmmenu&method=get

/api/admin?type=tree&id=dev&method=getmeta
/api/admin?type=tree&id=dev&method=get

/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=getmeta
/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=get

/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=getmeta
/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=get


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
