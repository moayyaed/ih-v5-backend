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

  doCommand(dobj, prop) {
    const did = dobj._id;
    /*
    let virt = false;
    const sendObj = this.getWriteChan(did, prop);
    if (sendObj) {
      this.holder.emit('send:device:command', sendObj);
      // TODO - про одностороннюю связь??
      return;
    }
    */
    dobj.runCommandHandler(prop);
  },

  getWriteChan(did, prop) {
    return this.holder.chanlinkSet && this.holder.chanlinkSet[did + '_' + prop] && this.holder.chanlinkSet[did + '_' + prop].w
      ? this.holder.chanlinkSet[did + '_' + prop]
      : '';
  },


  emitDeviceDataAccepted(accepted) {
    if (!accepted || !accepted.length) return;
    
  // emitDeviceDataChanged(changed) {
    this.holder.emit('accepted:device:data', accepted);

    const changed = accepted.filter(item => item && item.changed);

    if (changed.length) {
      this.holder.emit('changed:device:data', changed);
      // console.log('DE EMIT changed:device:data' + util.inspect(changed));
    }
    // console.log('AG EMIT changed:device:data' + util.inspect(changed));
  },

  /**
   *
   * @param {*} unit
   * @param {*} did
   * @param {*} prop
   * @param {*} value
   * @param {*} command
   */
  sendCommand(sendObj) {
    this.holder.emit('send:device:command', sendObj);
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
  },

  startAlert(did, prop, txt, level) {
    this.holder.emit('start:alert', {owner:did+'_'+prop, txt, level});
  },

  stopAlert(did, prop) {
    this.holder.emit('stop:alert', {owner:did+'_'+prop});
  }


};
