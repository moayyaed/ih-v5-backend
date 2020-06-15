/**
 * agent.js
 *
 * Agent for devo instances
 *  - emits via holder
 *  - works with device timers
 */

const util = require('util');

const Timerman = require('../utils/timermanager');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.tm = new Timerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  emitDeviceDataChanged(changed) {
    this.holder.emit('changed:device:data', changed);
    console.log('AG EMIT changed:device:data' + util.inspect(changed));
  },

  sendCommand() {
    // this.holder.emit();
  },

  startTimer(interval, did, prop) {
    const owner = did;
    const tname = prop;
    // Удалить таймер, взведенный ранее
    this.tm.deleteAllTimers({ owner, tname });
    const res = this.tm.startTimer(interval, { owner, tname }); // { sts: ct, qts: ct + tick * 100 }

    this.holder.devSet[did].saveQts(prop, res.qts);
  },

  // Отработка событий таймеров устройств (таймеры взводят функции-обработчики)
  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      const { owner, tname } = timeobj;

      if (this.holder.devSet[owner]) {
        this.holder.devSet[owner].saveQts(tname, 0);
        this.holder.devSet[owner].runCalcFun(tname, { timer: tname });
      }
    }
  }
};
