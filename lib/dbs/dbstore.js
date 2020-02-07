/**
 * dbstore.js
 * Работа с коллекциями данных
 */

const util = require('util');
const Datastore = require('nedb');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const validator = require('./validator');

const db = {};
let cdesc = {};

function start(collectionsDescObj) {
  cdesc = collectionsDescObj;
  Object.keys(cdesc).forEach(name => {
    const folder = cdesc[name].folder || 'jbasepath';
    const filename = appconfig.get(folder) + '/' + name + '.db';
    db[name] = new Datastore({ filename, autoload: true });
  });
}

function get(collection, filter = {}, order) {
  console.log('get ' + collection);
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

  return new Promise((resolve, reject) => {
    db[collection].find(filter, (err, data) => {
      // console.log('after find err=' + util.inspect(err)+' docs='+util.inspect(data));
      if (!err) {
        resolve(order ? data.sort(hut.byorder(order)) : data);
      } else reject(err);
    });
  });
}

function insert(collection, docs) {
  console.log('insert ' + collection);
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

  try {
    validate(collection, docs, 'insert')
  } catch (e) {
    return Promise.reject(e);
  }

  return new Promise((resolve, reject) => {
    db[collection].insert(docs, (err, newDocs) => {
      console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
      if (!err) {
        resolve(newDocs);
      } else reject(err);
    });
  });
}

function validate(collection, docs, oper) {
  try {
    const valObj = cdesc[collection].validator;
    if (valObj) {
      for (const doc of docs) {
        if (oper == 'insert') {
        validator.checkInsert(doc, valObj);
        } else validator.checkUpdate(doc, valObj);
      }
    }
  } catch (e) {
    const error = 'ERRVALIDATE';
    const message = 'Collection: ' + collection + (e.doc && e.doc._id ? ', id:' + e.doc._id : '') + '. ' + e.message;
    throw { error, message };
  }
}

function update(collection, filter, docsToUpdate, options) {
  console.log('update ' + collection);
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });
  try {
    validate(collection,docsToUpdate);
  } catch (e) {
    return Promise.reject(e);
  }

  return new Promise((resolve, reject) => {
    options = options || { multi: false, upsert: false, returnUpdateDocs: true };
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
}

function remove(collection, filter, options) {
  console.log('remove ' + collection);
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

}
function getData({ collection, filter, order }) {
  console.log('getData ' + collection);
  console.log('getData order=' + order);
  return get(collection, filter, order);
}

module.exports = {
  start,
  get,
  getData,
  insert,
  update,
  remove
};
