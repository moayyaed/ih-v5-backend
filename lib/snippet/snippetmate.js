/**
 * snippetmate.js
 *
 */
const util = require('util');
// const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const snippetProps = ['snipuse', 'snipperiod', 'snipid'];

class Snippetmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;

     // Слушать события изменения таблиц, связанных с устройствами и глобальными переменными
     // Если меняют привязку к сниппету (snipuse, snipperiod, snipid ) 
     // Добавление сниппета без привязки роли не играет
     // Удаление сниппета не выполняется, если есть привязки
     this.dm.on('updated:globals', docs => {
      // Изменены переменные
      docs.forEach(doc => {
        if (doc.$set) {
          const changedProps  = hut.arrayIntersection(Object.keys(doc.$set), snippetProps);
          if (changedProps.length) {
            if (changedProps.includes('snipuse') && doc.$set.snipuse == 0) {
              // больше не используется 
              this.engine.removeItem(doc._id);
            }  else {
              // this.engine.updateItem(doc._id, doc, changedProps);
            }
          }
        }
      });
    });

    this.dm.on('removed:globals', docs => {
      // Удалены переменные - если были связаны со сниппетами - удалить сниппеты
      docs.forEach(doc => this.engine.removeItem(doc._id));
    });



  }

  async start() {
    const res = [];
    const docs = await this.dm.dbstore.get('globals', {});
    docs.forEach(doc => {
      if (doc.snipuse && doc.snipid) {
        // Проверить, что файл существует? Можно по списку snippetList
        const file =   appconfig.getSnippetFilename(doc.snipid)
        res.push({ did: doc._id, file, period: doc.snipperiod });
      }
    });

    // const toInstallSet = new Set();  - ПОКА ЗАВИСИМОСТИ НЕ УЧИТЫВАЮТСЯ

    // По всем устройствам и глобальным переменным - если есть сниппет - найти его и записать в массив
    // Если файла нет - не включать
    // Вернуть массив [{did, file, period}]
    return res;
  }
}

module.exports = Snippetmate;
