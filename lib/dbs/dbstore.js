/**
 * dbstore.js
 * Работа с коллекциями данных
 */

const util = require('util');
const Datastore = require('nedb');

const validator = require('./validator');
const hut = require('../utils/hut');

const db = {};

function start(collections) {
  collections.forEach(item => {
    if (item.name && item.filename) {
      db[item.name] = new Datastore({ filename: item.filename, autoload: true });
    } else {
      console.log('dbstore.start: Expected array of {name,filename} items');
    }
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

  return new Promise((resolve, reject) => {
    db[collection].insert(docs, (err, newDocs) => {
      console.log('after insert err=' + util.inspect(err) + ' newDocs=' + util.inspect(newDocs));
      if (!err) {
        resolve(newDocs);
      } else reject(err);
    });
  });
}

function update(collection, filter, docsToUpdate, options) {
  console.log('update ' + collection);
  if (!db[collection]) return Promise.reject({ error: 'SOFTERR', message: 'No collection ' + collection });

  return new Promise((resolve, reject) => {
    options = options || { multi: false, upsert: false, returnUpdateDocs: true };
    db[collection].update(filter, docsToUpdate, options, (err, numAffected) => {
      console.log('after update err=' + util.inspect(err) + ' numAffected=' + numAffected);
      if (err) reject(err);
      if (!numAffected) reject({ error: 'ERRUPDATE', message: 'Collection '+collection+'. Record not found:' + JSON.stringify(filter) });

      resolve();
    });
  });
}

function getData({ collection, filter, order }) {
  console.log('getData ' + collection);
  console.log('getData order=' + order);
  // if (collection == 'types') {
    return get(collection, filter, order);
  // }

/*
  return new Promise((resolve, reject) => {
    let result;
    switch (collection) {
      case 'lists':
        result = [
          { _id: 123, parent: 0, name: 'Мой дом' },
          { _id: 456, parent: 123, name: '1 этаж', order: 200 },
          { _id: 214, parent: 456, name: 'Холл' },
          { _id: 810, parent: 456, name: 'Кухня' },
          { _id: 457, parent: 123, name: '2 этаж', order: 100 },
          { _id: 458, parent: 123, name: 'Мансарда' },
          { _id: 919, parent: 456, name: 'Гостиная' },
          { _id: 920, parent: 457, name: 'Спальня', order: 300 },
          { _id: 921, parent: 457, name: 'Детская', order: 100 },
          { _id: 922, parent: 457, name: 'Каминная', order: 400 },
          { _id: 923, parent: 457, name: 'Душевая', order: 200 }
        ];
        break;
      case 'devices':
        result = [
          { _id: 'LAMP1', level: 214, name: 'Лампа в холле' },
          { _id: 'LAMP2', level: 810, name: 'Лампа на кухне' }
        ];
        break;
      case 'tgroup':
        result = [
          { _id: 1, parent: 0, name: 'Типы' },
          { _id: 2, parent: 1, name: 'Температуры' }
        ];
        break;
      case 'type':
        result = [
          { _id: 'TEMP_COMMON', tgroup: 2, name: 'Датчик температуры' },
          { _id: 'TEMP_X', tgroup: 2, name: 'Датчик Xiaomi' }
        ];
        break;
      default:
    }
    if (order) {
      console.log('SORT ' + order);
      result.sort(hut.byorder(order));
    }
    resolve(result);
  });
  */
}

module.exports = {
  start,
  get,
  getData,
  insert,
  update
};
