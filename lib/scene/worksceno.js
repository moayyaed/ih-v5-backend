/**
 * worksceno.js - объект рабочего сценария
 * - Фиксирует текущее состояние экземпляра, количество запусков
 *   Если сценарий в дочернем процессе, флаг child=1
 */

// const util = require('util');

class Worksceno {
  constructor(opt, agent) { // opt = { id, sceneId, child, debug, blk, multi, error }
    Object.assign(this, opt);
    
    this.__active = 0; // 0 - не запущен, 1 - запущен
    this.laststart = 0;
    this.laststop = 0;
    this.qstarts = 0;
    this.agent = agent;
  }

  isActive() {
    return this.__active === 1;
  }


  isReady() {
    return !this.__active && !this.blk;
  }

  get state() {
    if (this.__active) return 1;
    if (this.blk) return 2;
    return 0;
  }

  __started(ts) {
    this.__active = 1;
    this.laststart = ts;
    this.qstarts += 1;
    this.agent.debug(this.id, 'Started');
  }

  __stopped(ts) {
    this.__active = 0;
    this.laststop = ts;
    this.agent.debug(this.id, 'Stopped');
  }
}

module.exports = Worksceno;
