/**
 *  dyndata.js
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const descObj = require('./ddo');
const cache = require('./cache');
const appconfig = require('../utils/appconfig');

const appdir = appconfig.get('appdir');

module.exports = {
  // Получение динамических данных для интерфейса по типу и имени:
  // {type:'menu', id:'pmmenu'} | {type:'tree', id:'devices'}
  // Данные берутся по возможности из кэша или от db подсистемы.
  // Если в кэше нет - подгружаются в кэш
  // В кэше ключ составной: type_id
  get(type, id ) {
    // Если данные кэшируются - сразу берем из кэша и выходим
    // Это могут быть одноузловые деревья, меню
    const key = getCacheKey(type, id);
    if (cache.has(key)) return Promise.resolve(cache.get(key));

    // Получаем описание элемента данных
    const desc = getDescItem(type, id);
    // if (desc.store == 'db') return dyndb.get(); // Данные вернет движок db

    if (type == 'tree' && Array.isArray(desc)) {
      // Многоузловые деревья - нужно каждое дерево загрузить в кэш, затем сформировать из кэша и вернуть как один объект
    }

    // Загрузить в кэш, потом вернуть
    return this.loadSystem(type, id );
  },

  // Загружает данные в кэш, возвращает загруженные данные
  loadSystem(type, id ) {
    const desc = getDescItem(type, id);

    return new Promise((resolve, reject) => {
      if (!desc) reject({ error: 'SOFTERR', message: 'LOADING ERROR' });

      const filename = path.resolve(appdir, desc.folder, desc.file+'.json'); // desc.folder
      console.log('Load '+filename);
      
      fs.promises.readFile(filename, 'utf8')
      .then(buf => {
        const data = JSON.parse(buf.toString());
        appconfig.translateSys(data);
        const key = getCacheKey(type, id);
        cache.set(key, data);
        resolve(cache.get(key));
      })
      .catch(e=> {
        console.log('reject '+util.inspect(e));
        reject(e);
      });
    });
  },

  find() {},

  remove() {},

  addItem() {},

  deleteItem() {},

  updateItem() {}
};

function getDescItem(type, id) {
  return descObj[type] && descObj[type][id] ? descObj[type][id] : '';
}

function getCacheKey(type, id) {
  return `${type}_${id}`;
}
