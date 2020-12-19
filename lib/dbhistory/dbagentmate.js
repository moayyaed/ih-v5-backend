/**
 * dbagentmate.js
 */

// const dbagentutil = require('./dbagentutil');

class Dbagentmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
   
    /** НЕ ОТСЛЕЖИВАЕТСЯ. Старт другого агента делается только при перезагрузке
    this.dm.on('inserted:dbagent', docs => {
      // Запускается только один арент - д б 1 документ
      if (docs.length) this.engine.addUnit('dbagent', docs[0]);
    });
    */

    this.dm.on('updated:dbagent', docs => {
      docs.forEach(doc => {
        if (doc.$set) {
          if (doc.active) {
            const upDoc = Object.assign({}, doc, doc.$set);
            delete upDoc.$set;
            this.engine.updateUnit(doc._id, upDoc);
          }
        }
      });
    });

    this.dm.on('removed:dbagent', docs => {
      docs.forEach(doc => {
        if (doc.active) this.engine.removeUnit(doc._id);
      });
    });
  }
}

module.exports = Dbagentmate;
