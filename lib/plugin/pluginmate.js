/**
 * pluginmate.js
 *
 */
// const util = require('util');
// const path = require('path');

// const appconfig = require('../appconfig');
const pluginutil = require('./pluginutil');

class Pluginmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  start() {
    this.dm.on('inserted:units', async docs => {
      for (const doc of docs) {
        // Если это папка - не надо ничего делать!!
        if (!doc.folder) {
          const uobj = await this.engine.createUnit(doc);
          this.engine.addUnit(doc._id, uobj);
        }
      }
    });

    this.dm.on('updated:units', docs => {
      docs
        .filter(doc => !doc.folder)
        .forEach(doc => {
          if (doc.$set) {
            const upDoc = Object.assign({}, doc, doc.$set);
            delete upDoc.$set;
            this.engine.updateUnit(doc._id, upDoc);
          }
        });
    });

    this.dm.on('removed:units', docs => {
      docs.forEach(doc => {
        if (!doc.folder) {
          this.engine.removeUnit(doc._id, doc);
        } else {
          // Сбросить кэш манифеста и форм для папки
          pluginutil.invalidateCache(doc._id, this.dm);
        }
      });
    });

    // ****** Изменение каналов
    // Форма канала + через link
    this.dm.on('inserted:devhard', async docs => {
      this.onChannelsChange(docs, 'add');
    });

    this.dm.on('updated:devhard', docs => {
      this.onChannelsChange(docs, 'update');
    });

    this.dm.on('removed:devhard', docs => {
      this.onChannelsChange(docs, 'delete');
    });

    // В таблице unitchannelsTable
    this.dm.on('inserted:unitchannelsTable', async docs => {
      this.onChannelsChange(docs, 'add');
    });

    this.dm.on('updated:unitchannelsTable', docs => {
      this.onChannelsChange(docs, 'update');
    });

    this.dm.on('removed:unitchannelsTable', docs => {
      this.onChannelsChange(docs, 'delete');
    });
  }

  async onChannelsChange(docs, op) {
    // - группировать по плагинам
    const docsByUnit = {};
    docs.forEach(doc => {
      const rdoc = { op, ...doc, ...doc.$set };
      delete rdoc.$set;

      if (doc.unit) {
        if (!docsByUnit[doc.unit]) docsByUnit[doc.unit] = [];
        docsByUnit[doc.unit].push(rdoc);
      }
    });

    for (const unit of Object.keys(docsByUnit)) {
      // Полностью считать каналы заново
      this.engine.unitChannelsUpdated(unit, docsByUnit[unit]);
    }
  }
}

module.exports = Pluginmate;
