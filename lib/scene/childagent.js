/**
 * childagent.js
 *
 * Agent for sceno instances in child process
 *  - works with scene timers
 */

const util = require('util');

const hut = require('../utils/hut');
const Timerman = require('../utils/timermanager');

const timersCallbackMap = new Map();

module.exports = {
  start() {
    this.tm = new Timerman(0.1);
    // this.tm.on('ready', this.onTimerReady.bind(this));
  },

  log(id, msg) {
    this.debug(id, msg);
  },

  debug(id, msg) {
    process.send({ type: 'debug', id, text: hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg });
  }
};
