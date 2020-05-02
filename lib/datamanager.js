/**
 *  datamanager.js
 *
 *  Слой работы с данными (не историческими)
 *
 */

const util = require('util');

const hut = require('./utils/hut');
const loadsys = require('./utils/loadsys');

const descriptor = require('./descriptor');
const numerator = require('./dbs/numerator');
const cache = require('./dbs/cache');
const specform = require('./dbs/specform');

const datautil = require('./api/datautil');

const EventEmitter = require('events');

class Datamanager extends EventEmitter {
  constructor() {
    super();
    this.dbstore = require('./dbs/nedb/dbstore'); // Здесь нужно будет считать из config, какая БД
    this.numerator = numerator;
    this.cache = cache;
  }

  async start() {
    this.cache.start(createInvalidateList());

    this.dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

    // Запуск объекта-нумератора, для каждой таблицы сформировать правило нумерации
    const tables = loadsys.loadAndTranslateJsonFileSync('dbs', 'tables');
    for (const table of Object.keys(tables)) {
      await this.numerator.createNumerator(table, tables[table], this.dbstore);
    }

    // Создать корневые записи для деревьев
    // - в collection lists - их много
    const data = await this.dbstore.get('lists', { parent: 0 });
    const found = hut.arrayToObject(data, 'list');
    const docsToWrite = descriptor.createNonexistentListsRootNodes(found);
    if (docsToWrite.length > 0) {
      await this.dbstore.insert('lists', docsToWrite);
    }

    // Другие таблицы - должен быть ровно один корневой узел
    const tablesWithRoot = ['unitgroup'];
    for (const table of tablesWithRoot) {
      await this.checkAndCreateRootRecord(table);
    }
  }

  async checkAndCreateRootRecord(table) {
    const desc = descriptor.getTableDesc(table);
    const docs = await this.dbstore.get(desc.collection, { parent: 0 });
    let ok = docs.length == 1;

    if (ok) {
      // Проверить, что _id=table
      ok = docs[0]._id == table;
    }
    if (!ok) {
      if (docs.length) {
        await this.removeThisDocs(table, docs);
      }
      const docsToWrite = descriptor.createRootNode(table);
      await this.dbstore.insert(desc.collection, docsToWrite);
    }
  }

  getFromCache(query) {
    const key = getCacheKey(query);
    if (this.cache.has(key)) {
      console.log(key + ' from cache!');
      return this.cache.get(key);
    }
  }

  async getCachedData(query, prepFn) {
    const key = getCacheKey(query);
    if (this.cache.has(key)) {
      console.log(key + ' from cache!');
      return this.cache.get(key);
    }

    let data;
    if (prepFn) {
      data = await prepFn(query);
    } else if (query.method == 'getmeta') {
      data = await this.getMeta(query);
    } else {
      throw { err: 'SOFTERR', message: 'Missing function for data prepare, query=' + JSON.stringify(query) };
    }

    this.cache.set(key, data);
    return this.cache.get(key);
  }

  /**
   * Возвращает объект из системного файла данных
   *
   * @param {String} type - тип объекта
   * @param {String} id - идентификатор объекта
   *
   */
  async getSystemData({ type, id }) {
    const data = await loadsys.loadSystemData(type, id);
    const key = getCacheKey({ type, id });
    this.cache.set(key, data);
    return this.cache.get(key);
  }

  /**
   * Возвращает метаданные
   */
  async getMeta(query) {
    let { type, id } = query;
    return type == 'form' && specform.isSpecForm(id) ? specform.getForm(query, this) : loadsys.loadMeta(type, id);
  }

  /**
   *  Добавление документов в хранилище
   *   - операция добавления
   *   - сброс кэша
   *   - генерация сообщения inserted:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - массив документов, которые нужно добавить
   */
  async insertDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);
    await this.dbstore.insert(desc.collection, docs);

    cache.invalidate(table);
    // liststore.onInsertDocs(table, docs);
    this.emit('inserted:' + table, docs);
  }

  /**
   *  Изменение документов в хранилище
   *   - операция изменения
   *   - сброс кэша
   *   - генерация сообщения updated:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - документы, которые нужно изменить.
   *     Каждый документ содержит $set и/или $unset атрибут c изменениями
   */
  async updateDocs(table, docs, beforeUpdate) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);

    for (const doc of docs) {
      if (doc.$set || doc.$unset) {
        // Доработка прикладного уровня, если требуется
        if (typeof beforeUpdate == 'function') {
          await beforeUpdate(table, doc);
        }

        const setUnset = {};
        if (doc.$set) setUnset.$set = doc.$set;
        if (doc.$unset) setUnset.$unset = doc.$unset;
        await this.dbstore.update(desc.collection, { _id: doc._id }, setUnset);
      }
    }

    cache.invalidate(table); // Сброс деревьев для таблицы
    cache.invalidateKeys(getKeysToClearForDependentForms(table, docs)); // Сброс кэша для форм, связанных с конкретной записью

    // liststore.onUpdateDocs(table, docs);
    this.emit('updated:' + table, docs);
  }

  // Сброс для конкретного ключа (исп для сброса при записи в файл - layout, container)
  invalidateCache(query) {
    const key = getCacheKey(query);
    cache.delete(key);
  }

  /**
   * Синхронизация таблицы с папкой со скриптами (сценарии, обработчики)
   */
  async reviseTableWithFolder(table, syncFunc) {
    const desc = descriptor.getDescItem('table', table);
    const docs = await this.dbstore.get(desc.collection);
    const changeDocs = await syncFunc(docs);
    const insertDocs = [];
    const updateDocs = [];
    changeDocs.forEach(item => {
      if (typeof item == 'object') {
        const newFlag = item.new;
        delete item.new;
        if (newFlag) {
          insertDocs.push(item);
        } else {
          updateDocs.push(item);
        }
      }
    });

    if (insertDocs.length) {
      await this.insertDocs(table, insertDocs);
    }

    if (updateDocs.length) {
      await this.updateDocs(table, updateDocs);
    }
  }

  /**
   *  Удаление документов из хранилища:
   *   - операция удаления
   *   - сброс кэша
   *   - генерация сообщения removed:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - массив документов, которые нужно удалить, содержат текущее состояние док-та
   */
  async removeDocs(table, docs, beforeRemove) {
    if (!table || !docs || !docs.length) return;

    // Проверить, что удалить нельзя ЗДЕСЬ??
    if (beforeRemove) {
      for (const doc of docs) {
        await beforeRemove(table, doc);
      }
    }

    await this.removeThisDocs(table, docs);
    cache.invalidate(table);
    this.emit('removed:' + table, docs);
  }

  async removeThisDocs(table, docs) {
    const desc = descriptor.getDescItem('table', table);
    const arr = docs.map(item => item._id);
    const filter = datautil.createIdsInFilter(arr);

    await this.dbstore.remove(desc.collection, filter, { multi: arr.length > 1 });
  }
}

module.exports = new Datamanager();

function getCacheKey(query) {
  return getCacheIds(query).join('_');
}

function getMetaCacheIds(query) {
  let { type, id } = query;
  return id && specform.isSpecForm(id) ? specform.getMetaCacheIds(query) : ['META', type, id];
}

function getCacheIds(query) {
  if (query.method == 'getmeta') return getMetaCacheIds(query);

  const ids = ['type', 'id', 'nodeid'];
  const res = [];
  for (let i = 0; i < ids.length; i++) {
    if (!query[ids[i]]) return res;
    res.push(query[ids[i]]);
  }
  return res;
}

// Построить объект связи имя таблица - массив id деревьев
// для инвалидации кэша при редактировании таблиц, связанных с деревьями
function createInvalidateList() {
  const result = {};

  const singleTrees = descriptor.getSingeTreesAray();

  singleTrees.forEach(treeId => {
    const descItem = descriptor.getTreeDesc(treeId);
    const addItem = (table, id) => {
      if (!result[table]) result[table] = [];
      result[table].push(getCacheKey({ type: 'tree', id }));
    };

    if (descItem.branch.table) addItem(descItem.branch.table, treeId);
    if (descItem.leaf.table) addItem(descItem.leaf.table, treeId);
  });
  return result;
}

function getKeysToClearForDependentForms(table, docs) {
  // Сбросить кэши для формы, связанной с конкретной записью таблицы Неважно, что меняют?
  const forms = specform.getRecordDependentForms(table);
  if (!forms || !docs) return;

  const keysToClear = [];
  forms.forEach(formId => {
    docs.forEach(doc => {
      keysToClear.push(getCacheKey({ method: 'getmeta', type: 'form', id: formId, nodeid: doc._id }));
      keysToClear.push(getCacheKey({ method: 'getmeta', type: 'upform', id: formId, nodeid: doc._id }));
    });
  });
  return keysToClear;
}

/*
{ "method": "insert",
  "type": "tree",
  "id": "dev",
  "payload": {
      "types": { 
       "nodes":[{"parentid":"SensorD", "order":75, "popupid":"t230"}]
    }
  }
}
{ "method": "copypaste",
  "type": "tree",
  "id": "dev",
  "nodeid":"ActorD", 
  "order":1000, 
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}

{ "method": "update",
  "type": "tree",
  "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD", "order":42}], 
      "nodes":[{"nodeid":"t200", "parentid":"SensorA", "order":75}]  
    }
  }
}

{ "method": "remove",
  "type": "tree",
  "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}],
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}


*/
