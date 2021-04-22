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

const hut = require('../utils/hut');
// const deviceutil = require('./deviceutil');
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

    // Отработать изменения - запустить обработчики и/или сценарии
    const changed = accepted.filter(item => item && item.changed);
    if (changed.length) this.wCore.emit('changed:device:data', changed);
  },

  /**
   * Запуск обработчиков свойств, команд и форматирования
   * Они могут вызываться из обработчика верхнего уровня или сценария
   *
   *
   * @param {} dobj
   * @param {*} hanid
   * @param {*} fn
   * @param {*} prop
   * @param {*} arg3
   * @param {*} arg4
   */
  runHandler(dobj, hanid, fn, prop, arg3, arg4) {
    if (!fn || !dobj || !dobj._id) return;

    let result;
    let currentScript;
    const did = dobj._id;
    try {
      if (!this.wCore.currentScriptTs) {
        // Иначе запущен из другого
        currentScript = 1;
        const ts = Date.now();
        this.wCore.postMessage('trace:handler', { did, hanid, state: 1, ts });
        this.wCore.currentScriptTs = Date.now();
      }
      
      // ЗАПУСК
      result = fn(dobj, prop, arg3, arg4);
      if (currentScript) {
        this.wCore.postMessage('trace:handler', { did, hanid, state: 0, ts: Date.now() });
      }
    } catch (e) {
      // Во время выполнения этого скрипта произошла ошибка - блокировать этот обработчик - передать на main
      this.wCore.postMessage('trace:handler', { did, hanid, state: 0, blk: 1, error: hut.getErrStrWoTrace(e) });

      // Нужно у себя блокировать!!
      this.setScriptBlk(hanid, 1);
      if (currentScript) {
        this.devSet[did].agent.logDevice(did, {
          ts: Date.now(),
          prop: 'error',
          txt: 'Device Handler for "' + prop + '" invalid!'
        });
      }
    }
    if (currentScript) {
      this.wCore.currentScriptTs = 0;
    }
    return result;
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

  // Команда логирования
  logDevice(did, logObj) {
    this.wCore.postMessage('log:device:devicelog', { did, ...logObj });
  },

  // Записать в mainloglog, генерировать событие для подписки
  logMain(logObj) {
    // this.wCore.logconnector.addLog('mainlog', { ...logObj });
    this.wCore.postMessage('log:device:mainlog', { ...logObj });
    // console.log('Worker Agent logMain ' + util.inspect(logObj));
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
