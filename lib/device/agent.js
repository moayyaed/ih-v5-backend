/**
 * agent.js
 *
 * Agent for devo instances
 *  - emits via holder
 *  - works with device timers
 */

const util = require('util');

const deviceutil = require('./deviceutil');
const Timerman = require('../utils/timermanager');

module.exports = {
  start(holder, dm) {
    this.holder = holder;
    this.dm = dm;
    this.tm = new Timerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  writeDeviceChannel(did, sendObj) {
    console.log('agent.writeDeviceChannel '+util.inspect(sendObj))
    // this.holder.emit('write:plugin', sendObj);
    this.holder.emit('send:device:command', sendObj);
  },

  sendDeviceCommand(did, sendObj, val) {
    if (val != undefined) sendObj.val = val;
    this.holder.emit('send:device:command', sendObj);
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
    this.holder.emit('start:alert', { owner: did + '_' + prop, txt, level });
  },

  stopAlert(did, prop) {
    this.holder.emit('stop:alert', { owner: did + '_' + prop });
  },

  saveParam(did, prop, saveObj) {
    this.dm.upsertDocs('devparam', [{ _id: did + '_' + prop, ...saveObj }]);
  },

  logDevice(did, logObj) {
    // Сформировать сообщения для подписки
    const dobj = this.holder.devSet[did];
    if (dobj) {
      const data = [deviceutil.getLogTitleAndMessage(dobj, logObj)];
      this.holder.emit('devicelog', { did, data });
    }
    // Записать в файл - храним объект
    this.dm.insertToLog('devicelog', { did, ...logObj });
  },

  getExtprop(dn, prop, sceneId) {
    return this.holder.extprops[sceneId] && this.holder.extprops[sceneId][dn] && this.holder.extprops[sceneId][dn][prop]
      ? this.holder.extprops[sceneId][dn][prop]
      : '';
  },

  getExtpropTitle(dn, prop, sceneId) {
    return this.holder.extprops[sceneId] && this.holder.extprops[sceneId][dn] && this.holder.extprops[sceneId][dn][prop]
      ? this.holder.extprops[sceneId][dn][prop].note 
      : prop;
  }
};
