/**
 * agent_w.js
 *
 * Agent for devo_w instances
 *  - emits via 
 *  - works with device timers
 * 
 *  writeDeviceChannel
 * emitDeviceDataAccepted
 * getExtpropTitle
 * getExtprop
 * 
 * setTimer
 * clearTimer
 * 
 * saveCurrent
 * 
 * logDevice
 * logMain
 */

const util = require('util');

const deviceutil = require('./deviceutil');
const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(wCore) {
    this.wCore = wCore;
    this.isWorker = true;
 
    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  writeDeviceChannel(did, sendObj) {
    this.wCore.emit('send:device:command', sendObj);
  },


  // Это точка, в которой выполняется accepted:device:data - данные приняты устройством
  emitDeviceDataAccepted(accepted) {
    if (!accepted || !accepted.length) return;
    this.wCore.postMessage('accepted:device:data', accepted);
  },

  saveParam(did, prop, saveObj) {
  },

  saveCurrent(isParam, saveObj) {
  },
  

  /**
   * Отработка таймеров устройства
   * @param {Object}
   *           {String} owner - did
   *           {String}tname - prop  - Это просто имя таймера,уникальное для устройства, не обязательно имя свойства
   *           {Number} interval
   *           {Bool} restart = true Если таймер уже взведен - взводит повторно. Иначе не взводит (startTimer)
   *
   * @param {Function} callback
   */
  setTimer({ owner, tname, interval, restart }, callback) {
    this.tm.setTimer({ owner, tname, interval, restart }, callback);
  },

  clearTimer(owner, tname) {
    this.tm.clearTimer(owner, tname);
  },

  // Отработка событий таймеров устройств (таймеры взводят функции-обработчики)
  onTimerReady({ owner, tname, callback, sts, qts }) {
    if (!owner || !tname || !callback || !this.wCore.devSet[owner]) return;
    callback(this.wCore.devSet[owner]); // функцию запускаем для устройства - хозяина
  },


  // Команда логирования ?? 
  logDevice(did, logObj) {
    // const dobj = this.wCore.devSet[did];
    console.log('Worker Agent logDevice '+did+' '+util.inspect(logObj)+'..skipped')
  },

  // Записать в mainloglog, генерировать событие для подписки
  logMain(logObj) {

    // this.wCore.logconnector.addLog('mainlog', { ...logObj });
    console.log('Worker Agent logMain '+util.inspect(logObj)+' skipped')
  },

  // Заполнение innerLog устройства при первом показе данными из таблицы devicelog (до перезагрузки)
  async fillInnerLogFromTable(did) {
    return deviceutil.fillInnerLogFromTable(did, this.wCore);
  },

  getExtprop(dn, prop, sceneId) {
    return this.wCore.extprops[sceneId] && this.wCore.extprops[sceneId][dn] && this.wCore.extprops[sceneId][dn][prop]
      ? this.wCore.extprops[sceneId][dn][prop]
      : '';
  },

  getExtpropTitle(dn, prop, sceneId) {
    return this.wCore.extprops[sceneId] && this.wCore.extprops[sceneId][dn] && this.wCore.extprops[sceneId][dn][prop]
      ? this.wCore.extprops[sceneId][dn][prop].note
      : prop;
  }
};
