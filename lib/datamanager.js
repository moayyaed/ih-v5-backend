/**
 *  datamanager.js
 *
 *  Слой работы с данными (не историческими)
 */

const util = require('util');

const hut = require('./utils/hut');

const dbstore = require('./dbs/dbstore');
const descriptor = require('./dbs/descriptor');
// const numerator = require('./dbs/numerator');
const cache = require('./dbs/cache');
const loadsys = require('./dbs/loadsys');
const dataformer = require('./dbs/dataformer');
const updater = require('./dbs/updater');
const updatetree = require('./dbs/updatetree');
const tagmanager = require('./dbs/tagmanager');

const EventEmitter = require('events');

class Datamanager extends EventEmitter {
  async start() {
    // Запуск хранилища, передать ему список коллекций
    dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

    // Из некоторых коллекций считать тэги, создать tagMap
    tagmanager.start();

    const tables = loadsys.loadAndTranslateJsonFileSync('dbs', 'tables');
    // Запуск объекта-дескриптора, передать ему описание деревьев, таблиц и списков
    descriptor.start(
      loadsys.loadAndTranslateJsonFileSync('dbs', 'trees'),
      tables,
      loadsys.loadAndTranslateJsonFileSync('dbs', 'lists')
    );

    // Запуск объекта-нумератора, передать ему описание таблиц
    // numerator.start(tables);

    // Построить объект для инвалидации кэша при редактировании таблиц cacheInvalidateList
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
    if (cache.has(key)) {
      console.log('FROM cache ' + key);
      return cache.get(key);
    }

    const desc = descriptor.getDescItem(type, id);

    // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
    if (desc.store == 'db') {
      this.emit('getting', 'Getting from dbstore, collection: ' + desc.collection);
      const data = await dbstore.getData(desc);
      return { data, ts: Date.now() };
    }

    return dataformer.get(type, id, nodeid, meta); // Подготовка данных и запись их в кэш
  }

  async copyTo(body) {
    if (body.type == 'tree') {
      const res = await updatetree.copyTo(body);
      this.invalidateCacheForRequest(body);
      return res;
    }
  }

  /**
   * Вставка одной или нескольких записей по запросу от API
   *  - добавляет в хранилище
   *  - в случае удачной операции удаляет кэши, связанные с этими данными
   *
   * @param {Object} body
   * @return {Object}
   */
  async insert(body) {
    if (body.type == 'tree') {
      const res = await updatetree.insert(body);
      this.invalidateCacheForRequest(body);
      return res;
    }
  }

  invalidateCache(changedTables) {
    console.log('changedTables ' + changedTables);
    if (!changedTables) return;
    changedTables.forEach(table => {
      const keysToClear = this.cacheInvalidateList[table];
      console.log('invalidateCache ' + keysToClear);
      if (keysToClear) keysToClear.forEach(key => cache.delete(key));
    });
  }

  invalidateCacheForRequest(body) {
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

    changedTables.forEach(table => {
      const keysToClear = this.cacheInvalidateList[table];
      console.log('invalidateCache ' + keysToClear);
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
      const data = await updater.updateForm(body);
      this.invalidateCacheForRequest(body);
      return data ? { data } : '';
    }

    if (body.type == 'tree') {
      await updatetree.update(body);
      this.invalidateCacheForRequest(body);
    }
  }

  /**
   *
   */
  async remove(body) {
    if (body.type == 'tree') {
      const notRemoved = await updatetree.remove(body);
      this.invalidateCacheForRequest(body);

      if (notRemoved.length > 0) {
        throw { err: 'ERR', message: 'Folder cannot be removed: ' + notRemoved.join(',') };
      }
    }
  }
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
