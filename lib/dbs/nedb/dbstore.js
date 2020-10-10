/**
 * dbstore.js
 * Работа с коллекциями данных через nedb
 */

const util = require('util');
const Datastore = require('nedb');

const hut = require('../../utils/hut');
const appconfig = require('../../appconfig');

const db = {};
const ttl = {}; // timeToLive - для каждой коллекции с expireAfterSeconds

module.exports = {
  start(collectionsDescObj) {
    const cdesc = collectionsDescObj;
    Object.keys(cdesc).forEach(name => {
      const folder = cdesc[name].folder || 'jbasepath';
      const filename = appconfig.get(folder) + '/' + name + '.db';
      db[name] = new Datastore({ filename, autoload: true });
      if (cdesc[name].ensureIndex) {
        const fieldName = cdesc[name].ensureIndex;
        db[name].ensureIndex({ fieldName }, err => {
          if (err) {
            console.log(
              'ERROR: dbstore.start collection=' +
                name +
                ' fieldName=' +
                fieldName +
                ' ensureIndex error: ' +
                util.inspect(err)
            );
          }
        });
        if (cdesc[name].expireAfterSeconds) {
          ttl[name] = { afterMs: cdesc[name].expireAfterSeconds * 1000, last: 0, numRemoved: 0 };
        }
      }

      /*
      if (cdesc[name].expireAfterSeconds) {
        console.log('')
        db[name].ensureIndex({ fieldName: 'ts', expireAfterSeconds: cdesc[name].expireAfterSeconds }, (err) => {
          if (err) {
            console.log('ERROR: dbstore.start ds='+name+' ensureIndex error: '+util.inspect(err))
          }
        });
      }
      */
    });

    // Удаление записей для коллекций с ttl и упаковка
    const periodSec = 60;
    const numToCompact = 1000;

    setInterval(() => {
     
      const now = Date.now();
      Object.keys(ttl).forEach(name => {
        const item = ttl[name];
       
        const expired = now - item.afterMs;
       
        if (!item.last || (item.last <= expired)) {
         
          db[name].remove({ ts: { $lte: expired } }, { multi: true }, (err, numRemoved) => {
            if (numRemoved > 0) {
              
              item.numRemoved += numRemoved;
              if (item.numRemoved >= numToCompact) {
                console.log('INFO: '+name+' Removed '+item.numRemoved + ' recs.  NEED compact');
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
        // console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
        if (!err) {
          resolve(newDocs);
        } else reject(err);
      });
    });
  },

  update(collection, filter, docsToUpdate, options) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    return new Promise((resolve, reject) => {
      options = Object.assign({ multi: false, upsert: false, returnUpdateDocs: false },options) ;
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
