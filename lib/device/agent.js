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

const timersCallbackMap = new Map();

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
  setTimer( {owner, tname, interval, restart}, callback) {
    const key = owner+'_'+tname; 
    
    if (timersCallbackMap.has(key)) {
      if (!restart) return;  // Время проверить??

      timersCallbackMap.delete(key);
      this.tm.deleteAllTimers({ owner, tname });  // Можно и не удалять??
    }
  
    const res = this.tm.startTimer(interval, { owner, tname }); // { sts: ct, qts: ct + tick * 100 }
    timersCallbackMap.set(key, {sts:res.sts, qts:res.qts, callback});

    // TODO ??? Возможно, нужно сохранять взведенные таймеры между перезагрузками сервера
  },

  clearTimer( owner, tname) {
    const key = owner+'_'+tname; 
    if (timersCallbackMap.has(key)) {
      timersCallbackMap.delete(key);
      this.tm.deleteAllTimers({ owner, tname });  // Можно и не удалять??
    }
  },
    

  // Отработка событий таймеров устройств (таймеры взводят функции-обработчики)
  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      const { owner, tname } = timeobj;
      const key = owner+'_'+tname; 
      if (!timersCallbackMap.has(key)) return;

      const mapObj = timersCallbackMap.get(key);
      if (mapObj.callback && this.holder.devSet[owner]) {
        mapObj.callback(this.holder.devSet[owner]);
      }
      timersCallbackMap.delete(key);
    }
  },

  /**
   * Отработка алертов устройства
   * 
   * @param {} interval 
   * @param {*} did 
   * @param {*} prop 
   */
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
      // Сохранять в своем журнале тоже - не более 100 записей на устройство??
      dobj.addToInnerLog(logObj);

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
