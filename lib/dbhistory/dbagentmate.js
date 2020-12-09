/**
 * dbagentmate.js
 */

// const util = require('util');
// const fs = require('fs');

const appconfig = require('../appconfig');

const dbagentutil = require('./dbagentutil');

class Dbagentmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    // Создать таблицу dbagents
    await this.dm.reviseTableWithFolder('dbagent', dbagentutil.sync);

    this.dm.on('inserted:dbagent', docs => {
      // Запускается только один арент - д б 1 документ
      if (docs.length) this.engine.addUnit(docs[0]);
    });

    this.dm.on('updated:dbagent', docs => {
      docs.forEach(doc => {
        if (doc.$set) {
        const upDoc = Object.assign({}, doc, doc.$set);
        delete upDoc.$set;
        this.engine.updateUnit(upDoc)
        }
      });
    });

    this.dm.on('removed:dbagent', docs => {
      docs.forEach(doc => this.engine.removeUnit(doc));
    });

    return this.load();
  }

  async load() {
    //  Определяет, какая БД используется и загружает документ.
    const dbname = appconfig.get('project_dbname');
    return dbname ? this.dm.findRecordById('dbagent', dbname) : null;
  }
}

module.exports = Dbagentmate;
