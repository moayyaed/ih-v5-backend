/**
 * alertmate.js
 */

// const util = require('util');
// const fs = require('fs');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

class Alertmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  start() {
    /*
    // Добавлены новые журналы алертов
    this.dm.on('inserted:alertjournal', docs => {
      for (const doc of docs) {
        // this.engine.addGlobal(doc);
      }
    });

    // Изменены журналы
    this.dm.on('updated:alertjournal', docs => {
      for (const doc of docs) {
        const upDoc = Object.assign({}, doc, doc.$set);

        this.engine.setAlertJournals(doc._id, upDoc);
      }
    });

    // Удалены журналы
    this.dm.on('removed:alertjournal', docs => {
      for (const doc of docs) {
        this.engine.deleteAlertJournals(doc._id);
      }
    });
    */
  }
}

module.exports = Alertmate;
