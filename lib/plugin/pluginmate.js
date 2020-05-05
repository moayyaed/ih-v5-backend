/**
 * pluginmate.js
 *
 */
// const util = require('util');
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
    this.dm.on('inserted:devhard', async docs => {
      // Новые каналы для плагина (ов?)
      // - группировать по плагинам
      // - для каждого плагина
      //     - обновить readMap
      //     - если есть подписка для плагина - отправить по подписке
      const docsByUnit = {};
      docs.forEach(doc => {
        const unit = doc.$set.unit || doc.unit;
        if (!docsByUnit[unit]) docsByUnit[unit] = [];
        docsByUnit[unit].push(Object.assign({ op: 'add' }, doc, doc.$set));
      });
      Object.keys(docsByUnit).forEach(unit => {
        this.engine.sendOnSub('tableupdated', { unit, tablename: 'channels' }, docsByUnit[unit]);
        // Полностью считать заново?
        this.engine.updateChannels(this.loadUnitChannels(unit));
      });
    });

    this.dm.on('updated:devhard', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onUpdateUnit(doc));
    });

    this.dm.on('removed:devhard', docs => {
      if (!this.revising) docs.forEach(doc => this.engine.onRemoveUnit(doc));
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

    for (const unit of docs) {
      // if (unit.channels) {
      // Загрузить каналы (вся актуальная информация по каналам находится в devhard)
      // unit.charr = await this.dm.dbstore.get('devhard', {unit:unit._id}); // Массив каналов
      // }
      unit.charr = await this.loadUnitChannels(unit._id);
    }
    return docs;
  }

  async loadUnitChannels(unit) {
    return this.dm.dbstore.get('devhard', { unit: unit._id }); // Массив каналов
  }

  async onChannelsChange(docs, op) {
    // - группировать по плагинам
    const docsByUnit = {};
    docs.forEach(doc => {
      const unit = doc.$set.unit || doc.unit;
      if (!docsByUnit[unit]) docsByUnit[unit] = [];
      docsByUnit[unit].push({ op, ...doc, ...doc.$set });
    });

    for (const unit of Object.keys(docsByUnit)) {
      if (this.engine.unitSet[unit]) {
        // Отправить по подписке??
        this.engine.sendOnUnitSub('tableupdated', unit, { unit, tablename: 'channels' }, docsByUnit[unit]);

        // Полностью считать каналы заново и перестроить charr, readMap, writeMap
        // this.engine.unitSet[unit].updateChannels(await this.loadUnitChannels(unit));
      }
    }
  }
}

module.exports = Pluginmate;
