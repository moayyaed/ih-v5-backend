/**
 *  datamanager.js
 *
 *  Слой работы с данными (не историческими)
 */

const util = require('util');

const hut = require('./utils/hut');
const treeutil = require('./utils/treeutil');

const dbstore = require('./dbs/dbstore');
const descriptor = require('./dbs/descriptor');
const cache = require('./dbs/cache');
const loadsys = require('./dbs/loadsys');
const dataformer = require('./dbs/dataformer');
const updater = require('./dbs/updater');

const EventEmitter = require('events');

class Datamanager extends EventEmitter {
  async start() {
    // Запуск хранилища, передать ему список коллекций
    dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

    // Запуск объекта-дескриптора, передать ему описание деревьев, таблиц и списков
    descriptor.start(
      loadsys.loadAndTranslateJsonFileSync('dbs', 'trees'),
      loadsys.loadAndTranslateJsonFileSync('dbs', 'tables'),
      loadsys.loadAndTranslateJsonFileSync('dbs', 'lists')
    );

    // Построить таблицу для инвалидации кэша при редактировании таблиц cacheInvalidateList
    this.cacheInvalidateList = descriptor.getTreeCacheInvalidate();

    // Создать корневые записи для иерархических справочников в lists
    const data = await dbstore.get('lists', { parent: 0 });
    const found = hut.arrayToObject(data, 'list');
    const docsToWrite = descriptor.createNonexistentListsRootNodes(found);
    if (docsToWrite.length > 0) {
      await dbstore.insert('lists', docsToWrite);
    }
  }

  /**
   *  Получение данных по типу и имени (идентификатору):
   *    type='menu', id='pmmenu' | type='tree', id='devices'}
   *    Данные берутся из кэша или из dbstore
   *    Если в кэше нет - подгружаются в кэш
   *
   * @param {String} type - тип объекта
   * @param {String} id - идентификатор объекта
   * @return {Object}: {data, ts}
   */
  async get(type, id, nodeid, meta) {
    // Если данные кэшируются - сразу берем из кэша.
    // Это могут быть одноузловые деревья, меню, системные таблицы, формы
    const key = descriptor.getCacheKey(type, id, meta);
    if (cache.has(key)) return cache.get(key);

    const desc = descriptor.getDescItem(type, id);

    // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
    if (desc.store == 'db') {
      this.emit('getting', 'Getting from dbstore, collection: ' + desc.collection);
      const data = await dbstore.getData(desc);
      return { data, ts: Date.now() };
    }

    return dataformer.get(type, id, nodeid, meta); // Подготовка данных и запись их в кэш
  }

  async getDefault(type, id, nodeid) {
    return dataformer.getDefault(type, id, nodeid);
  }

  /**
 * Вставка одной или нескольких записей по запросу от API
 *  - добавляет в хранилище
 *  - в случае удачной операции удаляет кэши, связанные с этими данными
 * 
 * @param {Object} body:
    {
      "method": "insert",
      "type": "form", // 
      "id":"formTypeFolder", // 
      "payload":{"id":"77227799", "parent":"place1", "title":"Device 1", "order":10}
    } 
 * @return {Object} 
    {
      response:1,
      data:
    }
 */
  async insert(body) {
    if (body.type == 'form') {
      const changedTables = await updater.updateForm(body, 'insert');

      // Нужно еще emit и сброс кэша, если есть зависимости
      this.invalidateCache(changedTables);
      return;
    }

    const { desc, docsToWrite, keysToClear } = this.processBodyForUpdateMethods(body);

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

  invalidateCache(changedTables) {
    console.log('changedTables '+changedTables);
    if (!changedTables) return;
    changedTables.forEach(table => {
      const keysToClear = this.cacheInvalidateList[table];
      console.log('invalidateCache '+keysToClear);
      if (keysToClear) keysToClear.forEach(key => cache.delete(key));
    });
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
  async update(body) {
    if (body.type == 'form') {
      // return updater.updateForm(body);
      const changedTables = await updater.updateForm(body);

      // Нужно еще emit и сброс кэша, если есть зависимости
      this.invalidateCache(changedTables);
      return;
    }

    const { desc, docsToWrite, keysToClear } = await this.processBodyForUpdateMethods(body);

    // Проверить, что изменяемые записи существуют
    /*
    const idSet = new Set();
    docsToWrite.forEach(doc => {
      idSet.add(doc._id);
    });
    if (!idSet.size) throw { error: 'ERRUPDATE', message: 'No records to update!' };

    this.checkRecordsExist(desc.collection, createIdsInFilter(Array.from(idSet)), idSet);
    */

    // Для дерева нужно проверить, что parent существует в branch таблице
    if (body.type == 'tree') {
      await checkParentBranch(body, false);
    }

    // Изменить каждую отдельно!!? Так как здесь меняем по id
    // for (const doc of docsToWrite) {
    const doc = docsToWrite;

    await updateOne(desc.collection, doc);
    // }

    // Сброс кэша после удачного сохранения
    if (keysToClear) keysToClear.forEach(key => cache.delete(key));
  }

  /**
   *
   */
  async remove(body) {
    const { desc, docsToWrite, keysToClear } = this.processBodyForUpdateMethods(body);

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

      const cachedObj = cache.has(key) ? cache.get(key) : await dataformer.loadTree(treeId); // {data, ts}
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
  async processBodyForUpdateMethods(body) {
    if (!body.payload) throw { error: 'ERRPAYLOAD', message: 'No payload!' };
    let data = body.payload;

    // let desc = descriptor.getUpdateDesc(body);
    // if (Array.isArray(desc)) throw { error: 'ERRINSERT', message: 'Need options.root for composite tree!' };
    const { type, id, nodeid } = body;
    let desc;
    let docsToWrite;
    let keysToClear;

    if (body.type == 'tree') {
      desc = descriptor.getDescItem(type, id);
      const branchOrLeaf = body.options && body.options.leaf ? 'leaf' : 'branch';
      const table = desc[branchOrLeaf] && desc[branchOrLeaf].table ? desc[branchOrLeaf].table : '';
      if (!table) throw { error: 'SOFTERR', message: `No table prop for tree ${branchOrLeaf} ${body.id}` };

      docsToWrite = hut.mapProps(data, desc[branchOrLeaf].propremap);
      keysToClear = this.cacheInvalidateList[table];

      desc = descriptor.getDescItem('table', table);
    } else if (body.type == 'form') {
      // Для формы - каждый элемент отдельно: payload = {p1:{name:''}, p2:{txt:''}, p3:{devicecommonTable:[{id:},{}]}}
      // Преобразование полей делать не надо?

      const metaData = await dataformer.getMeta('form', id);
      const formMetaData = metaData.data;
      if (!formMetaData.grid) throw new Error('No "grid" prop in form!');
      docsToWrite = {};
      console.log('formMetaData.grid = ' + util.inspect(formMetaData.grid));
      // Получить данные из таблиц для формирования записей
      for (const cell of formMetaData.grid) {
        // Получить имя таблицы для каждой ячейки
        console.log('cell.table = ' + cell.table);
        if (cell.table && body.payload[cell.id]) {
          desc = descriptor.getTableDesc(cell.table);
          console.log('desc = ' + util.inspect(desc));
          docsToWrite = Object.assign({ _id: nodeid }, docsToWrite, body.payload[cell.id]);
        }
      }
    }

    // if (!desc.collection) throw { error: 'SOFTERR', message: 'Not found collection name for table=' + desc.table };
    console.log('desc = ' + util.inspect(desc));
    console.log('docsToWrite = ' + util.inspect(docsToWrite));
    return { desc, docsToWrite, keysToClear };
  }
}

// Частные функции

async function updateOne(collection, doc) {
  console.log('updateOne ' + collection);
  const filter = { _id: doc._id };
  delete doc._id;
  return dbstore.update(collection, filter, { $set: doc });
}

async function removeItems(arr, collection) {
  const filter = createIdsInFilter(arr);
  return dbstore.remove(collection, filter, { multi: arr.length > 1 });
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

function createIdsInFilter(arr) {
  const filter = {};
  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
  }
  return filter;
}

module.exports = new Datamanager();

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
