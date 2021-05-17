/**
 * dbstore.js
 * Объект для работы с коллекциями данных через nedb
 */

const util = require('util');
const Datastore = require('nedb');

const hut = require('../../utils/hut');
const appconfig = require('../../appconfig');

const db = {};
const ttl = {}; // timeToLive - для каждой коллекции с expireAfterSeconds
const needCompact = []; // Таблицы, которые переупаковываются каждый раз 

module.exports = {
  start(collectionsDescObj) {
    const cdesc = collectionsDescObj;
    Object.keys(cdesc).forEach(name => {
      try {
        if (cdesc[name].inMemory) {
          db[name] = new Datastore({});
        } else {
          const folder = cdesc[name].folder || 'jbasepath';
          const filename = appconfig.get(folder) + '/' + name + '.db';
          db[name] = new Datastore({ filename, autoload: true });
          if (cdesc[name].needCompact) {
            needCompact.push(name);
          }
        }
        

        if (cdesc[name].ensureIndex) {
          const fieldName = cdesc[name].ensureIndex;
          db[name].ensureIndex({ fieldName }, err => {
            if (err) {
              const errStr = 'ERROR: dbstore collection ' + name + ', ensureIndex ' + fieldName + ': ';
              console.log(errStr + hut.getShortErrStr(err));
            }
          });
          if (cdesc[name].expireAfterSeconds) {
            ttl[name] = { afterMs: cdesc[name].expireAfterSeconds * 1000, last: 0, numRemoved: 0 };
          }
        }
      } catch (e) {
        console.log('ERROR: dbstor collection ' + name + ': ' + hut.getShortErrStr(e) + '. Skipped');
      }
    });

    // Удаление записей для коллекций с ttl и упаковка
    const periodSec = 3600; // 3600 каждый час
    const numToCompact = 2000;

    setInterval(() => {
      // console.log('INFO: Compact dbstore START ');
      const now = Date.now();
      // Безусловная упаковка
      needCompact.forEach( name => {
        // console.log('INFO: Compact datafile ' + name);
        db[name].persistence.compactDatafile();
      });

      // Условная упаковка - titme to live + количество удаленных записей 
      Object.keys(ttl).forEach(name => {
        const item = ttl[name];

        const expired = now - item.afterMs;

        if (!item.last || item.last <= expired) {
          db[name].remove({ ts: { $lte: expired } }, { multi: true }, (err, numRemoved) => {
            if (numRemoved > 0) {
              item.numRemoved += numRemoved;
              if (item.numRemoved >= numToCompact) {
                console.log('INFO: ' + name + ' Removed ' + item.numRemoved + ' recs. Compact datafile ' + name);
                item.numRemoved = 0;
                db[name].persistence.compactDatafile();
              }
            }
          });
          item.last = now;
        }
      });
    }, periodSec * 1000);
  },

  createCustom(collection) {
    if (db[collection]) return;
    const folder = 'custombasepath';
    const filename = appconfig.get(folder) + '/' + collection + '.db';
    db[collection] = new Datastore({ filename, autoload: true, corruptAlertThreshold: 1 });
  },

  hasCollection(collection) {
    return !!db[collection];
  },

  get(collection, filter = {}, opt = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    // if (opt.sort && typeof opt.sort == 'object') {
    if (opt.sort) {
      const { sort, fields } = opt;
      const projection = fields || {}; // Передается projection - список полей: {name:1, txt:1}
      return new Promise((resolve, reject) => {
        db[collection]
          .find(filter, projection)
          .sort(sort)
          .exec((err, data) => {
            // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
            if (!err) {
              resolve(data);
            } else reject(err);
          });
      });
    }
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

  getLimited(collection, filter = {}, opt = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    // let { sort, limit, fields } = opt;
    const sort = opt.sort || { ts: 1 };
    const fields = opt.fields || {}; // Передается projection - список полей: {name:1, txt:1}
    const limit = opt.limit || 100;

    return new Promise((resolve, reject) => {
      db[collection]
        .find(filter, fields)
        .sort(sort)
        .limit(limit)
        .exec((err, data) => {
          // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
          if (!err) {
            resolve(data);
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

  count(collection, filter = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      db[collection].count(filter, (err, count) => {
        if (!err) {
          resolve(count);
        } else reject(err);
      });
    });
  },

  insert(collection, docs) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      db[collection].insert(docs, (err, newDocs) => {
        // console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
        if (!err) {
          resolve(newDocs);
        } else reject(err);
      });
    });
  },

  update(collection, filter, docsToUpdate, options) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });
    // console.log('update '+collection+'  filter ' + util.inspect(filter)+'  docsToUpdate ' + util.inspect(docsToUpdate)+'  options ' + util.inspect(options));
    return new Promise((resolve, reject) => {
      options = Object.assign({ multi: false, upsert: false, returnUpdateDocs: false }, options);
      db[collection].update(filter, docsToUpdate, options, (err, numAffected) => {
        // console.log('after update err=' + util.inspect(err) + ' numAffected=' + numAffected);
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
      db[collection].update(filter, docsToUpdate, options, (err, numAffected, affectedDocuments) => {
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
