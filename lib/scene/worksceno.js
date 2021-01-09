/**
 * worksceno.js - объект рабочего сценария
 */

const util = require('util');

class Worksceno {
  constructor(id, agent) {
    this.id = id;
    this.blk = 0;
    this.__active = 0; // 0 - не запущен, 1 - запущен
    this.laststart = 0;
    this.laststop = 0;
    this.qstarts = 0;
    this.agent = agent;
  }

  isActive() {
    return this.__active === 1;
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
