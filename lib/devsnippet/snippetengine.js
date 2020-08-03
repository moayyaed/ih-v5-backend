/**
 * Snippetengine.js
 */

// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const Timerman = require('../utils/timermanager');

const tm = new Timerman(1);

// const sceneutils = require('./sceneutils');

class Snippetengine {
  constructor(holder, dm, agent) {
    this.holder = holder;
    this.dm = dm;
    this.agent = agent;

    this.snippetSet = {};
    holder.snippetSet = this.snippetSet;


    tm.on('ready', this.onTimerReady.bind(this));

    holder.on('startsnippet', (did, period) => {
      this.startSnippet(did, period);
    });
    
   
  }

  start(unitDocs) {
  }
}

module.exports = Snippetengine;