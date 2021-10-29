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
    this.dm.on('updated:integration:devices', async (unitId, docs) => {
      this.engine.sendOnUnitSub('tableupdated', unitId, { tablename: 'devices', op: 'update' }, docs);
    });

    this.dm.on('updated:integration:types', async (unitId, docs) => {
      this.engine.sendOnUnitSub('tableupdated', unitId, { tablename: 'types', op: 'update' }, docs);
    });

    // Есть плагины, которые получают списки пользователей (телеграм)
    this.dm.on('inserted:infoaddr_common', async docs => {
      this.onInfoaddrChange(docs);
    });

    this.dm.on('updated:infoaddr_common', async docs => {
      this.onInfoaddrChange(docs);
    });

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

  async onInfoaddrChange(docs) {
    const docsByUnit = {};

    docs.forEach(doc => {
      if (doc.infotype) {
        if (!docsByUnit[doc.infotype]) docsByUnit[doc.infotype] = [];
        docsByUnit[doc.infotype].push(doc);
      }
    });

    for (const unit of Object.keys(docsByUnit)) {
      this.engine.sendOnUnitSub('tableupdated', unit, { tablename: 'infousers', op: 'update' }, docsByUnit[unit]);
    }
  }

  async onChannelsChange(docs, op) {
    // - группировать по плагинам
    const docsByUnit = {};
    docs.forEach(doc => {
      // Для плагинов chan - это id
      doc.oldid = doc.chan;
      const rdoc = { op, ...doc, ...doc.$set };
      rdoc.id = rdoc.chan;
      delete rdoc.$set;

      if (doc.unit) {
        if (!docsByUnit[doc.unit]) docsByUnit[doc.unit] = [];
        docsByUnit[doc.unit].push(rdoc);
      }
    });

    for (const unit of Object.keys(docsByUnit)) {
      // Полностью считать каналы заново
      this.engine.unitChannelsUpdated(unit, docsByUnit[unit], op);
    }
  }
}

module.exports = Pluginmate;
