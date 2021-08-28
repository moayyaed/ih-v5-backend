/**
 * schedmate.js
 *  - Слушает события изменения расписания - таблица schedrule
 */

const util = require('util');

// const schedutils = require('./schedutils');

class Schedmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    this.dm.on('updated:schedrule', docs => {
      docs.forEach(doc => {
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;
          this.engine.updateItem(doc._id, upDoc);
        }
      });
    });

    this.dm.on('removed:schedrule', docs => {
      docs.forEach(doc => {
        this.engine.removeItem(doc._id);
      });
    });
  }
}

module.exports = Schedmate;
