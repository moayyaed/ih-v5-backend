/**
 * pluginengine.js
 */
const util = require('util');
const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
const Timerman = require('../utils/timermanager');

const Unito = require('./unito');
// const sceneutils = require('./sceneutils');

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.agent = agent;

    this.unitSet = new Map();

    // Запустить механизм таймеров для интервальных таймеров c мин интервалом 100 мс
    const tm = new Timerman(0.1);
   //  tm.on('ready', this.onTimerReady);

    /*
    holder.on('startscene', (query) => {
      this.onStartScene(query);
    });
    */
  }

  start(unitDocs) {
    // Построить unitSet
    this.unitSet.clear();
    unitDocs.forEach(uobj => {
      // Сразу запускать 
    });
  }
}
module.exports = Pluginengine;