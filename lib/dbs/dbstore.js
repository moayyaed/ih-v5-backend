/**
 * dbstore.js
 * Работа с коллекциями данных
 */

// const util = require('util');
// const fs = require('fs');
// const path = require('path');

const Datastore = require('nedb');

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

function getData({table}) {
  return new Promise((resolve, reject) => {
    let result;
    switch (table) {
      case 'level': 
        result = [
          { _id: 123, parent: 0, name: 'Мой дом' },
          { _id: 456, parent: 123, name: '1 этаж' },
          { _id: 214, parent: 456, name: 'Холл' },
          { _id: 810, parent: 456, name: 'Кухня' },
          { _id: 457, parent: 123, name: '2 этаж' },
          { _id: 458, parent: 123, name: 'Мансарда' },
          { _id: 919, parent: 456, name: 'Гостиная' },
          { _id: 920, parent: 457, name: 'Спальня' },
          { _id: 921, parent: 457, name: 'Детская' },
          { _id: 922, parent: 457, name: 'Каминная' },
          { _id: 923, parent: 457, name: 'Душевая' }
        ];
        break;
        case 'device': 
        result = [
          { _id: 'LAMP1', level: 214, name: 'Лампа в холле'},
          { _id: 'LAMP2', level: 810, name: 'Лампа на кухне' }
        ];
        break;
        case 'tgroup': 
        result = [
          { _id: 1, parent: 0, name: 'Типы'},
          { _id: 2, parent: 1, name: 'Температуры' }
        ];
        break;
        case 'type': 
        result = [
          { _id: 'TEMP_COMMON', tgroup: 2, name: 'Датчик температуры'},
          { _id: 'TEMP_X', tgroup: 2, name: 'Датчик Xiaomi' }
        ];
        break;
      default:  
    }
    resolve(result);
  });
}

module.exports = {
  start,
  getData
};

/*
module.exports = {
  getData({table}) {
    return new Promise((resolve, reject) => {
      let result;
      switch (table) {
        case 'level': 
          result = [
            { _id: 123, parent: 0, name: 'Мой дом' },
            { _id: 456, parent: 123, name: '1 этаж' },
            { _id: 214, parent: 456, name: 'Холл' },
            { _id: 810, parent: 456, name: 'Кухня' },
            { _id: 457, parent: 123, name: '2 этаж' },
            { _id: 458, parent: 123, name: 'Мансарда' },
            { _id: 919, parent: 456, name: 'Гостиная' },
            { _id: 920, parent: 457, name: 'Спальня' },
            { _id: 921, parent: 457, name: 'Детская' },
            { _id: 922, parent: 457, name: 'Каминная' },
            { _id: 923, parent: 457, name: 'Душевая' }
          ];
          break;
          case 'device': 
          result = [
            { _id: 'LAMP1', level: 214, name: 'Лампа в холле'},
            { _id: 'LAMP2', level: 810, name: 'Лампа на кухне' }
          ];
          break;
          case 'tgroup': 
          result = [
            { _id: 1, parent: 0, name: 'Типы'},
            { _id: 2, parent: 1, name: 'Температуры' }
          ];
          break;
          case 'type': 
          result = [
            { _id: 'TEMP_COMMON', tgroup: 2, name: 'Датчик температуры'},
            { _id: 'TEMP_X', tgroup: 2, name: 'Датчик Xiaomi' }
          ];
          break;
        default:  
      }
      resolve(result);
    });
  }
}
*/

/*
const appdir = path.resolve(process.cwd());
const syspath = path.join(appdir, '..');

const db = {};

const dbpath =  path.join(syspath, 'nedb');

const filename = dbpath+'/users.db';
console.log(filename);


db.users = new Datastore({ filename, autoload: true });


db.users.insert({username : "Boris", year: 1946});
*/
