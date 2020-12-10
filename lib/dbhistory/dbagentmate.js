/**
 * dbagentmate.js
 */

// const util = require('util');
const path = require('path');

const appconfig = require('../appconfig');
const dbconnector = require('../dbconnector');

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
      if (docs.length) this.engine.addUnit('db', docs[0]);
    });

    this.dm.on('updated:dbagent', docs => {
      docs.forEach(doc => {
        if (doc.$set) {
          const upDoc = Object.assign({}, doc, doc.$set);
          delete upDoc.$set;
          this.engine.updateUnit('db', upDoc);
        }
      });
    });

    this.dm.on('removed:dbagent', docs => {
      docs.forEach(doc => this.engine.removeUnit('db', doc));
    });
    return this.load();
  }

  async load() {
    //  Определяет, какая БД используется и загружает документ.
    const dbname = appconfig.get('project_dbname');
    return dbname ? this.dm.findRecordById('dbagent', dbname) : null;
  }

  createUnit(doc) {
    const unit = {
      doc, // Сохранить как есть все что пришло из документа (параметры БД?)
      ps: '',
      id: 'db',
      dbname: doc._id,

      getModulepath() {
        return path.join(appconfig.get('agentspath'), this.dbname, 'dbagent.js'); // Путь к модулю для запуска
      },

      getArgs() {
        // Формировать аргументы командной строки
        const options = {
          database: this.doc.database,
          logfile: appconfig.get('logpath') + '/ih_' + this.dbname + '.log'
        };
        return [JSON.stringify(options)];
      },
      connector: dbconnector,

      send(sendObj) {
        if (this.ps) this.ps.send(sendObj);
      },
      sendSigterm() {
        if (this.ps) {
          this.ps.kill('SIGTERM');
          this.ps = 0;
          this.sigterm = 1;
        }
      }
    };

    return unit;
  }
}

module.exports = Dbagentmate;
