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
        unit.charr = await this.dm.dbstore.get('devhard', {unit:unit._id}); // Массив каналов
      // }
    }
    return docs;
  }
}

module.exports = Pluginmate;