/**
 * pluginmate.js
 *
 */
const util = require('util');
// const fs = require('fs');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
// const sceneutils = require('./sceneutils');

class Pluginmate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  async start() {
    this.revising = true;
    // await this.dm.reviseTableWithFolder('scene', sceneutils.syncScripts);
    this.revising = false;

    this.dm.on('inserted:unit', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onInsertUnit(doc));
    });

    this.dm.on('updated:unit', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onUpdateUnit(doc));
    });

    this.dm.on('removed:unit', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onRemoveUnit(doc));
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

    // Слушать папку со плагинами?
    /*
    fs.watch(appconfig.getScriptPath(), (eventType, filename) => {
      if (this.revising) return;
      this.processWatchResult(eventType, filename);
    });
    */

    return this.load();
  }

  // Загрузить данные из таблицы units +  ?
  // Вернуть массив объектов для построения unitSet - параметры экземпляров. Каналов здесь нет?
  async load() {
    const docs = await this.dm.dbstore.get('units');
    const result = [];
    for (const doc of docs) {
      if (!doc.folder && doc.plugin) {
        // Загрузить каналы, если есть ??
        const charr = await this.loadUnitChannels(doc._id);
        result.push({ ...doc, charr });
      }
    }
    return result;
  }

  async loadUnitChannels(unit) {
    return this.dm.dbstore.get('devhard', { unit }); // Массив каналов
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
      /*
      if (this.engine.unitSet[unit]) {
        // Полностью считать каналы заново и перестроить readMap, writeMap
        this.engine.unitSet[unit].updateChannels(await this.loadUnitChannels(unit));

        // Обновить общий Map каналов для записи - удалить все элементы с unit и добавить заново
        this.engine.refreshWriteChanMap(unit);

        // Отправить по подписке - обновление каналов для плагинов
        this.engine.sendOnUnitSub('tableupdated', unit, { tablename: 'channels' }, docsByUnit[unit]);

        // Старые плагины без подписки могут просто перезагружаться при изменении каналов 
        // this.engine.channelsUpdated()

      }
      */

    }
  }
}

module.exports = Pluginmate;
