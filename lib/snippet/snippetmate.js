/**
 * snippetmate.js
 *
 */
const util = require('util');
// const fs = require('fs');

const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
// const sceneutils = require('./sceneutils');

class Snippetmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
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
