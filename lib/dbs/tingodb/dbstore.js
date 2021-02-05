/**
 * dbstore.js
 * Объект для работы с коллекциями данных через tingodb
 */


const util = require('util');
const Db = require('tingodb')().Db;

const hut = require('../../utils/hut');





const db = {};
const ttl = {}; // timeToLive - для каждой коллекции с expireAfterSeconds

module.exports = {
  start(collectionsDescObj, folder) {
    const cdesc = collectionsDescObj;
   
    try {
      const database = new Db(folder, {});
      console.log('create TINGO DB '+folder)
      
       Object.keys(cdesc).forEach(name => {
          db[name] = database.collection(name);
          console.log('create TINGO collection '+name)
          /*
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
          */

        });

      } catch (e) {
        console.log('ERROR: tingodb: ' +  hut.getShortErrStr(e));
      }
  
  },

  hasCollection(collection) {
    return !!db[collection];
  },

  get(collection, filter = {}, opt = {}) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    // if (opt.sort && typeof opt.sort == 'object') {
    if (opt.sort) {
      const { sort } = opt;
    
      return new Promise((resolve, reject) => {
        db[collection].find(filter).sort(sort).toArray((err, data)=> {
          // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
          if (!err) {
            resolve(data);
          } else reject(err);
        });
      });
      
    } 
      const { order } = opt;
    
      return new Promise((resolve, reject) => {
        db[collection].find(filter).toArray((err, data) => {
          // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
          if (!err) {
            resolve(order ? data.sort(hut.byorder(order)) : data);
          } else reject(err);
        });
      });
    
  },

  findOne(collection, filter) {
    if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

    if (!filter || hut.isObjIdle(filter))
      return Promise.reject({ error: 'SOFTERR', message: 'Expected filter for findOne, collection ' + collection });

    return new Promise((resolve, reject) => {
      db[collection].findOne(filter, (err, doc) => {
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
      db[collection].insert(docs, { w: 1 }, (err, newDocs) => {
        if (!err) {
          resolve(newDocs);
        } else reject(err);
      });
    });
  },

 
  getData({ collection, filter, order, fields }) {
    const opt = { fields, order };
    return this.get(collection, filter, opt);
  }
};
