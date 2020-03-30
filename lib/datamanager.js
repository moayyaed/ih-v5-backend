/**
 *  datamanager.js
 *
 *  Слой работы с данными (не историческими)
 */

// const util = require('util');

// const hut = require('./utils/hut');

const dbstore = require('./dbs/dbstore');
const descriptor = require('./dbs/descriptor');
const cache = require('./dbs/cache');
const datautil = require('./dbs/datautil');


const EventEmitter = require('events');

class Datamanager extends EventEmitter {
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
    await dbstore.insert(desc.collection, docs);

    cache.invalidate(table);
    this.emit('inserted:' + table, { docs });
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
  async updateDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);

    for (const doc of docs) {
      if (doc.$set || doc.$unset) {
        const setUnset = {};
        if (doc.$set) setUnset.$set = doc.$set;
        if (doc.$unset) setUnset.$unset = doc.$unset;
        await dbstore.update(desc.collection, { _id: doc._id }, setUnset);
      }
    }

    cache.invalidate(table);
    this.emit('updated:' + table, { docs });
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
  async removeDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    // Проверить, что удалить нельзя ЗДЕСЬ??
    const desc = descriptor.getDescItem('table', table);
    const arr = docs.map(item => item._id);
    const filter = datautil.createIdsInFilter(arr);

    await dbstore.remove(desc.collection, filter, { multi: arr.length > 1 });
    cache.invalidate(table);
    this.emit('removed:' + table, { docs });
  }
}

module.exports = new Datamanager();

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
