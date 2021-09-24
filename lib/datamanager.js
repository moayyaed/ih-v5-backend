/**
 *  datamanager.js
 *
 *  Объект для работы с данными (не историческими)
 *  Обеспечивает
 *      - запись/чтение данных через dbstore
 *      - механизм кэширования считанных данных
 *      - доступ к прикладным данным через datagetter, datamaker
 */

const util = require('util');

const hut = require('./utils/hut');
const loadsys = require('./utils/loadsys');

// const appconfig = require('./appconfig');
const descriptor = require('./descriptor');
const numerator = require('./dbs/numerator');
const cache = require('./dbs/cache');

const EventEmitter = require('events');

class Datamanager extends EventEmitter {
  constructor() {
    super();
    this.dbstore = require('./dbs/nedb/dbstore');

    this.numerator = numerator;
    this.cache = cache;
  }

  async start({ datagetter, datamaker, isNoCache }) {
    this.datagetter = datagetter; // анемичный объект с методами
    this.datamaker = datamaker; // анемичный объект с методами
    this.isNoCache = isNoCache; // функция
    this.cache.start(this.createInvalidateList());
    // this.dbstore - NeDB --------------------
    // collections - только nedb
    this.dbstore.start(loadsys.loadAndTranslateJsonFileSync('dbs', 'collections'));

    // tables: store:'db' - nedb; store:'none' - virt
    // Запуск объекта-нумератора, для каждой таблицы сформировать правило нумерации

    const tables = loadsys.loadAndTranslateJsonFileSync('dbs', 'tables');
    for (const table of Object.keys(tables)) {
      if (tables[table].store == 'db') {
        await this.numerator.createNumerator(table, tables[table], this.dbstore);
      }
    }

    // Создать корневые записи для деревьев
    // - в collection lists - их много
    const data = await this.dbstore.get('lists', { parent: 0 });
    const found = hut.arrayToObject(data, 'list');
    const docsToWrite = descriptor.createNonexistentListsRootNodes(found);
    if (docsToWrite.length > 0) {
      await this.dbstore.insert('lists', docsToWrite);
    }

    for (const table of Object.keys(descriptor.descObj.table)) {
      if (descriptor.descObj.table[table].filter && descriptor.descObj.table[table].filter.folder == 1) {
        await this.checkAndCreateRootRecord(table);
      }
      if (descriptor.descObj.table[table].requiredRecords) {
        await this.checkAndCreateRequiredRecords(table);
      }
    }

    // customtables - загрузить. Получить все таблицы из папки custombase
    const customtables = await loadsys.getCustombaseList();
    console.log('INFO: Custom Tables (custombase): ' + customtables.join(', '));
    customtables.forEach(name => this.createCustom(name));
  }

  createCustom(name) {
    // if (this.dbstore.hasCollection(name)) return;

    descriptor.addCustomTableDesc(name);
    this.dbstore.createCustom(name);
  }

  createCustomTable(name) {
    if (this.dbstore.hasCollection(name)) return;
    console.log('INFO: Create custom table ' + name);
    this.createCustom(name);
  }

  async checkAndCreateRequiredRecords(table) {
    const desc = descriptor.getTableDesc(table);
    let reqRecs = desc.requiredRecords;
    if (typeof reqRecs != 'object') return;

    const docsToWrite = [];
    if (!Array.isArray(reqRecs)) reqRecs = [reqRecs];
    const errStr = 'ERROR: requiredRecords for table ' + table + '. ';

    try {
      for (const rec of reqRecs) {
        if (!rec.check || !rec.add) throw { message: 'requiredRecords must have "check" and "add" props. Skipped.' };

        const doc = await this.dbstore.findOne(desc.collection, rec.check);
        if (!doc) docsToWrite.push(rec.add);
      }
      return docsToWrite.length ? this.dbstore.insert(desc.collection, docsToWrite) : '';
    } catch (e) {
      console.log(errStr + hut.getShortErrStr(e));
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

  saveToCache(query, data) {
    const key = this.getCacheKey(query);
    this.cache.set(key, data);
  }

  getFromCache(query) {
    const key = typeof query == 'object' ? this.getCacheKey(query) : query;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
  }

  getCacheTs(query) {
    const key = typeof query == 'object' ? this.getCacheKey(query) : query;
    if (this.cache.has(key)) {
      return this.cache.getTs(key);
    }
  }

  async getCachedData(query, prepFn) {
    const key = this.getCacheKey(query);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    let data;
    if (prepFn) {
      data = await prepFn(query, this);
    } else if (query.method == 'getmeta') {
      data = await this.getMeta(query);
    } else {
      throw { err: 'SOFTERR', message: 'Missing function for data prepare, query=' + JSON.stringify(query) };
    }

    if (this.isNoCache(query)) return { data };

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
  async getSystemData(query) {
    const { type, id } = query;
    const data = this.datagetter.isSpecSystemData(type, id)
      ? await this.datagetter.getSpecSystemData(query, this)
      : await loadsys.loadSystemData(type, id);
    // let data = await loadsys.loadSystemData(type, id);
    const key = this.getCacheKey({ type, id });
    this.cache.set(key, data);
    return this.cache.get(key);
  }

  /**
   * Возвращает метаданные
   */
  async getMeta(query) {
    let { type, id } = query;
    if (id == 'null') return {};

    // return type == 'form' && specform.isSpecForm(id) ? specform.getForm(query, this) : loadsys.loadMeta(type, id);
    return this.datagetter.isSpecMeta(type, id) ? this.datagetter.getSpecMeta(query, this) : loadsys.loadMeta(type, id);
  }

  async findRecordById(table, _id) {
    if (!table || !_id) return;
    const desc = descriptor.getDescItem('table', table);
    return this.dbstore.findOne(desc.collection, { _id });
  }

  async findOne(table, filter = {}) {
    if (!table) return;
    const desc = descriptor.getDescItem('table', table);
    return this.dbstore.findOne(desc.collection, filter);
  }

  // Вернет объект изменения, если есть изменения
  // Генерирует ошибку, если запись не найдена
  // В случае, если изменений нет - ничего не возвращает
  async checkFieldsWithRecord(table, _id, fields) {
    if (!table || !_id || !fields) throw { message: 'compareFieldsWithRecord: Missing table or _id' };

    const doc = await this.findRecordById(table, _id);
    if (!doc) throw { message: 'compareFieldsWithRecord. Not found record: table ' + table + ', _id=' + _id };
    let res;
    Object.keys(fields).forEach(field => {
      if (!doc[field] || fields[field] != doc[field]) {
        if (!res) res = {};
        res[field] = fields[field];
      }
    });
    return res;
  }

  async qRecords(table) {
    let docs = [];
    try {
      if (this.datagetter.isVirttable(table)) {
        docs = await this.datagetter.getVirttable(table, '', table, '', '', { dm: this }); // не все таблицы будут нормально работать!!
        return docs.length;
      }
      const desc = descriptor.getDescItem('table', table);
      return this.dbstore.count(desc.collection, { folder: { $ne: 1 } });
    } catch (e) {
      console.log('ERROR: qRecords table=' + table + ': ' + util.inspect(e));
    }
  }

  // Функции используются в restapi:holder.dm.get()
  async get(table, filter = {}, opt = {}) {
    if (!table) return [];
    const desc = descriptor.getDescItem('table', table);
    if (!desc) throw { message: 'Not found table ' + table };

    return this.dbstore.get(desc.collection, filter, opt); // {order:'_id', fields: {name:1, txt:1}}
  }

  async getTree(treeId, filter = {}, opt = {}) {
    if (!treeId) return [];
    return this.datagetter.getTreeData(treeId, filter, this);
  }

  //
  async getContent(name, query) {
    return this.datagetter.getContent(name, query, this);
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

    try {
      const desc = descriptor.getDescItem('table', table);
      await this.dbstore.insert(desc.collection, docs);
      cache.invalidate(table);
      this.emit('inserted:' + table, docs);
    } catch (e) {
      console.log(
        'ERROR: datamanager.insertDocs table=' + table + ', docs = ' + util.inspect(docs) + '. ' + util.inspect(e)
      );
      throw { message: 'Insert to ' + table + ' faild: ' + hut.getShortErrStr(e) };
    }
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
      try {
        if (doc.$set || doc.$unset) {
          // Доработка прикладного уровня, если требуется
          if (typeof beforeUpdate == 'function') {
            await beforeUpdate(table, doc, this);
          }

          const setUnset = {};
          if (doc.$set) setUnset.$set = doc.$set;
          if (doc.$unset) setUnset.$unset = doc.$unset;
          await this.dbstore.update(desc.collection, { _id: doc._id }, setUnset);
        }
      } catch (e) {
        console.log('ERROR: datamanager.updateDocs for doc = ' + util.inspect(doc) + '. ' + util.inspect(e));
        throw e && e.message ? hut.shortenErrResponse(e) : 'Update doc error!';
      }
    }

    cache.invalidate(table); // Сброс деревьев для таблицы
    cache.invalidateKeys(this.getKeysToClearForDependentForms(table, docs)); // Сброс кэша для форм, связанных с конкретной записью
    this.emit('updated:' + table, docs);
  }

  /**
   *  Добавление или замена (перезапись) документов в хранилище
   *   - операция записи в БД
   *   - сброс кэша
   *   - генерация сообщения upserted:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - документы, которые нужно добавть или изменить
   *     Каждый документ содержит полную запись для замены
   */
  async upsertDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);

    for (const doc of docs) {
      try {
        await this.dbstore.update(desc.collection, { _id: doc._id }, doc, { multi: false, upsert: true });
      } catch (e) {
        console.log(
          'ERROR: datamanager.upsertDocs in table ' + table + ' for doc = ' + util.inspect(doc) + '. ' + util.inspect(e)
        );
      }
    }

    cache.invalidate(table); // Сброс деревьев для таблицы
    this.emit('upserted:' + table, docs);
  }

  // Сброс для конкретного ключа (исп для сброса при записи в файл - layout, container)
  invalidateCache(query) {
    const key = this.getCacheKey(query);
    cache.delete(key);
  }

  /**
   * Синхронизация таблицы с папкой (сценарии, обработчики, картинки)
   *  Выполняется добавление и изменение документов таблицы
   *
   * @param {String} table - имя таблицы
   * @param {function} syncFunc - функция синхронизации - выполняет обработку файлов в папке
   *                              и их сличение с записями таблицы
   *                   Результат syncFunc - массив изменений:
   *                   [{new:1, doc:{_id,name...}}, {doc:{_id, name, $set:{}...}}]
   */
  async reviseTableWithFolder(table, syncFunc, folderPath, root) {
    const desc = descriptor.getDescItem('table', table);
    const docs = await this.dbstore.get(desc.collection);
    const changeDocs = await syncFunc(docs, folderPath, root);
    // console.log('reviseTableWithFolder changeDocs='+util.inspect(changeDocs))

    if (!changeDocs) return;

    const insertDocs = [];
    const updateDocs = [];
    const removeDocs = [];
    changeDocs.forEach(item => {
      if (typeof item == 'object' && item.doc) {
        if (item.new) {
          insertDocs.push(item.doc);
        } else if (item.del) {
          removeDocs.push(item.doc);
        } else {
          updateDocs.push(item.doc);
        }
      }
    });

    if (removeDocs.length) {
      await this.removeDocs(table, removeDocs);
    }

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
        await beforeRemove(table, doc, this);
      }
    }

    await this.removeThisDocs(table, docs);
    cache.invalidate(table);
    this.emit('removed:' + table, docs);
  }

  async removeThisDocs(table, docs) {
    const desc = descriptor.getDescItem('table', table);
    const arr = docs.map(item => item._id);
    const filter = hut.createIdsInFilter(arr);

    await this.dbstore.remove(desc.collection, filter, { multi: arr.length > 1 });
  }

  async getManifest(unit, refresh) {
    if (refresh) this.invalidateCache({ method: 'getmeta', type: 'manifest', id: unit });
    const manifest = await this.getCachedData({ method: 'getmeta', type: 'manifest', id: unit });
    return manifest && manifest.data ? manifest.data : {};
  }

  async getManifestItem(unit, prop) {
    const manifest = await this.getCachedData({ method: 'getmeta', type: 'manifest', id: unit });
    return manifest && manifest.data ? (prop ? manifest.data[prop] : manifest.data) : '';
  }

  async getPluginInfo(unit) {
    const plugininfo = await this.getCachedData({ method: 'getmeta', type: 'plugininfo', id: unit });
    return plugininfo.data;
  }

  async getDbagentInfo(unit) {
    const dbagentinfo = await this.getCachedData({ method: 'getmeta', type: 'dbagentinfo', id: unit });
    return dbagentinfo.data;
  }

  getCacheIds(query) {
    if (query.method == 'getmeta') return this.getMetaCacheIds(query);
    if (query.method && query.method != 'get') return this.datagetter.getMethodCacheIds(query);

    const ids = ['type', 'id', 'nodeid'];
    const res = [];
    for (let i = 0; i < ids.length; i++) {
      if (!query[ids[i]]) return res;
      res.push(query[ids[i]]);
    }
    return res;
  }

  getMetaCacheIds(query) {
    let { type, id } = query;

    // return id && specform.isSpecForm(id) ? specform.getMetaCacheIds(query) : ['META', type, id];
    return id && type == 'form' && this.datagetter.isSpecMeta(type, id)
      ? this.datagetter.getMetaCacheIds(query)
      : ['META', type, id];
  }


  getCacheKey(query) {
    const res = this.getCacheIds(query).join('_');
    return res;
  }

  getKeysToClearForDependentForms(table, docs) {
    // Сбросить кэши для формы, связанной с конкретной записью таблицы Неважно, что меняют?
    const forms = this.datagetter.getRecordDependentForms(table);
    if (!forms || !docs) return;

    const keysToClear = [];
    forms.forEach(formId => {
      docs.forEach(doc => {
        keysToClear.push(this.getCacheKey({ method: 'getmeta', type: 'form', id: formId, nodeid: doc._id }));
        keysToClear.push(this.getCacheKey({ method: 'getmeta', type: 'upform', id: formId, nodeid: doc._id }));
      });
    });
    return keysToClear;
  }

  // Построить объект связи имя таблица - массив id деревьев
  // для инвалидации кэша при редактировании таблиц, связанных с деревьями
  // Описание м б в trees или в tables
  createInvalidateList() {
    const result = {};

    const allTables = descriptor.getTablesAray();
    allTables.forEach(table => {
      const item = descriptor.getTableDesc(table);
      if (item.invalidatecache && Array.isArray(item.invalidatecache)) result[table] = item.invalidatecache;
    });

    const singleTrees = descriptor.getSingeTreesAray();
    singleTrees.forEach(treeId => {
      const descItem = descriptor.getTreeDesc(treeId);
      const addItem = (table, id, wildcachekey) => {
        if (!result[table]) result[table] = [];
        let key = this.getCacheKey({ type: 'tree', id });
        if (wildcachekey) key += '*';
        result[table].push(key);
      };

      if (descItem.branch.table) addItem(descItem.branch.table, treeId, descItem.leaf.wildcachekey);
      if (descItem.leaf.table) addItem(descItem.leaf.table, treeId, descItem.leaf.wildcachekey);
    });
    return result;
  }
}

module.exports = new Datamanager();

/** Helper functions */

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
