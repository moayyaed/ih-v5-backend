/**
 * pluginmate.js
 *
 */
// const util = require('util');


class Pluginmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {

    this.dm.on('inserted:units', docs => {
      docs.forEach(doc => this.engine.addUnit(doc));
    });

    this.dm.on('updated:units', docs => {
      docs.forEach(doc => this.engine.updateUnit(doc));
    });

    this.dm.on('removed:units', docs => {
      docs.forEach(doc => this.engine.removeUnit(doc));
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
      this.engine.unitChannelsUpdated(unit, docsByUnit[unit], await this.loadUnitChannels(unit) );

    }
  }
}

module.exports = Pluginmate;
