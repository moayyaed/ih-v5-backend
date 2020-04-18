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
    this.cache.start(descriptor.createTableTreeLinks('cache'));

    this.dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

    // Запуск объекта-нумератора, для каждой таблицы сформировать правило нумерации
    const tables = loadsys.loadAndTranslateJsonFileSync('dbs', 'tables');
    for (const table of Object.keys(tables)) {
      await this.numerator.createNumerator(table, tables[table], this.dbstore);
    }

    // Создать корневые записи для иерархических справочников в collection lists
    const data = await this.dbstore.get('lists', { parent: 0 });
    const found = hut.arrayToObject(data, 'list');
    const docsToWrite = descriptor.createNonexistentListsRootNodes(found);
    if (docsToWrite.length > 0) {
      await this.dbstore.insert('lists', docsToWrite);
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
    console.log('getCachedData ' + util.inspect(query));
    const key = getCacheKey(query);
    if (this.cache.has(key)) {
      console.log(key + ' from cache!');
      return this.cache.get(key);
    }

    let data;
    if (prepFn) {
      data = await prepFn(query);
    } else if (query.method == 'getmeta') {
      data = await getMeta(query);
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
    const key = descriptor.getCacheKey(type, id);
    this.cache.set(key, data);
    return this.cache.get(key);
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

    cache.invalidate(table);
    // liststore.onUpdateDocs(table, docs);
    this.emit('updated:' + table, docs);
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

    const desc = descriptor.getDescItem('table', table);
    const arr = docs.map(item => item._id);
    const filter = datautil.createIdsInFilter(arr);

    await this.dbstore.remove(desc.collection, filter, { multi: arr.length > 1 });
    cache.invalidate(table);
    // liststore.onRemoveDocs(table, docs);
    this.emit('removed:' + table, docs);
  }
}

module.exports = new Datamanager();

function getCacheKey(query) {
  const { method, type, id, nodeid } = query;
  const meta = method == 'getmeta' ? 'meta' : '';

  if (meta && nodeid && type == 'form') {
    if (isPluginMetaData(id)) {
      const [idx, nodeidx] = getPluginInstanceIdx(query);
      return `meta#${type}_${idx}_${nodeidx}`;
    }
  }
  let res = nodeid ? `${type}_${id}_${nodeid}` : `${type}_${id}`;
  return meta ? `meta#${res}` : res;
}

function getPluginInstanceIdx(query) {
  const { id, nodeid } = query;
  return id && id.indexOf('.') > 0 ? id.split('.') : [id, nodeid];
}

/**
 *
 * @param {} type
 * @param {*} idext
 * @param {*} nodeid
 */
// async function getMeta({type, idext, nodeid}) {
async function getMeta(query) {
  let { type, id, nodeid } = query;

  let data;
  if (type == 'form') {
    if (isPluginMetaData(id)) {
      const [idx, unit] = getPluginInstanceIdx(query);
      // Загрузить из папки плагина
      const plugindata = await loadsys.loadPluginMetaData(type, idx, unit);
      if (plugindata) {
        data = plugindata;
      } else id = idx; // Иначе стандарт
    }
  }

  if (!data) {
    data = await loadsys.loadMeta(type, id, nodeid);
  }
  return data;
}

function isPluginMetaData(id) {
  const spec = ['formPluginCommon', 'channelview', 'channelfolder', 'formPluginChannelsTable'];
  const formName = id.split('.')[0];
  return spec.includes(formName);
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
