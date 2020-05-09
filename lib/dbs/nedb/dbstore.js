/**
 * dbstore.js
 * Работа с коллекциями данных через nedb
 */

const util = require('util');
const Datastore = require('nedb');

const hut = require('../../utils/hut');
const appconfig = require('../../appconfig');

const db = {};

module.exports = {
  start(collectionsDescObj) {
    const cdesc = collectionsDescObj;
    Object.keys(cdesc).forEach(name => {
      const folder = cdesc[name].folder || 'jbasepath';
      const filename = appconfig.get(folder) + '/' + name + '.db';
      db[name] = new Datastore({ filename, autoload: true });
    });

    // Добавить индексы к некоторым коллекциям
    /** db.devhard.ensureIndex({ fieldName: 'unit' }, function (err) {
    // If there was an error, err is not null
  });
  */
  },

  get(collection, filter = {}, opt = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    const { order, fields } = opt;
    const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
    return new Promise((resolve, reject) => {
      db[collection].find(filter, projection, (err, data) => {
        // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
        if (!err) {
          resolve(order ? data.sort(hut.byorder(order)) : data);
        } else reject(err);
      });
    });
  },

  findOne(collection, filter, opt = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    if (!filter || hut.isObjIdle(filter))
      return Promise.reject({ error: 'SOFTERR', message: 'Expected filter for findOne, collection ' + collection });

    const { fields } = opt;
    const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
    return new Promise((resolve, reject) => {
      db[collection].findOne(filter, projection, (err, doc) => {
        if (!err) {
          resolve(doc);
        } else reject(err);
        // If no document is found, doc is null
      });
    });
  },

  insert(collection, docs) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      db[collection].insert(docs, (err, newDocs) => {
        console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
        if (!err) {
          resolve(newDocs);
        } else reject(err);
      });
    });
  },

  update(collection, filter, docsToUpdate, options) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      options = options || { multi: false, upsert: false, returnUpdateDocs: false };
      db[collection].update(filter, docsToUpdate, options, (err, numAffected) => {
        console.log('after update err=' + util.inspect(err) + ' numAffected=' + numAffected);
        if (err) reject(err);
        if (!numAffected)
          reject({
            error: 'ERRUPDATE',
            message: 'Collection ' + collection + '. Record not found:' + JSON.stringify(filter)
          });

        resolve();
      });
    });
  },

  updateAndReturnUpdatedDocs(collection, filter, docsToUpdate) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      const options = { multi: true, upsert: false, returnUpdatedDocs: true };
      db[collection].update(filter, docsToUpdate, options, (err, numAffected,  affectedDocuments) => {
        console.log('after update err=' + util.inspect(err) + ' numAffected=' + numAffected);
        if (err) reject(err);
        resolve(affectedDocuments);
      });
    });
  },
  
  remove(collection, filter, options) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      options = options || { multi: false };
      db[collection].remove(filter, options, (err, numRemoved) => {
        console.log('after remove err=' + util.inspect(err) + ' numRemoved=' + numRemoved);
        if (err) reject(err);
        if (!numRemoved)
          reject({
            error: 'ERRREMOVE',
            message: 'Collection ' + collection + '. Record not found:' + JSON.stringify(filter)
          });
        resolve(numRemoved);
      });
    });
  },

  getData({ collection, filter, order, fields }) {
    const opt = { fields, order };
    return this.get(collection, filter, opt);
  }
};

