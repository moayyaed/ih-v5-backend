/**
 * agent.js
 *
 * Agent for devo instances
 *  - emits via holder
 *  - works with device timers
 */

const util = require('util');

const appconfig = require('../appconfig');
const deviceutil = require('./deviceutil');
const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.deviceloglines = appconfig.get('deviceloglines') || 100;
    this.removedLines = {};

    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  writeDeviceChannel(did, sendObj) {
    this.holder.emit('send:device:command', sendObj);
  },

  sendDeviceCommand(did, sendObj, val) {
    if (val != undefined) sendObj.val = val;
    this.holder.emit('send:device:command', sendObj);
  },

  // Это точка, в которой выполняется accepted:device:data - данные приняты устройством
  emitDeviceDataAccepted(accepted) {
    if (!accepted || !accepted.length) return;
    this.holder.emit('accepted:device:data', accepted);
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
  setTimer({ owner, tname, interval, restart }, callback) {
    this.tm.setTimer({ owner, tname, interval, restart }, callback);
  },

  clearTimer(owner, tname) {
    this.tm.clearTimer(owner, tname);
  },

  // Отработка событий таймеров устройств (таймеры взводят функции-обработчики)
  onTimerReady({ owner, tname, callback, sts, qts }) {
    if (!owner || !tname || !callback || !this.holder.devSet[owner]) return;
    callback(this.holder.devSet[owner]); // функцию запускаем для устройства - хозяина
  },

  saveParam(did, prop, saveObj) {
    this.dm.upsertDocs('devparam', [{ _id: did + '.' + prop, ...saveObj }]);
  },

  saveCurrent(isParam, saveObj) {
    const _id = saveObj.did && saveObj.prop ? saveObj.did + '.' + saveObj.prop : '';
    if (!_id) return;

    this.dm.upsertDocs(isParam ? 'devparam' : 'devcurrent', [{ _id, ...saveObj }]);
  },

  // Записать в devicelog, генерировать событие для подписки
  logDevice(did, logObj) {
    const dobj = this.holder.devSet[did];
    if (dobj && dobj.innerLog) {
      const data = [deviceutil.getLogTitleAndMessage(dobj, logObj)];
      this.holder.emit('devicelog', { did, data });
      // Сохранить в журнале устройства 
      dobj.innerLog.push({ did, ...logObj });
      // console.log('devicelog did='+util.inspect(logObj)+' dobj.innerLog.length='+dobj.innerLog.length)

      // Удалить записи, если уже больше (+10?)
      if (dobj.innerLog.length > this.deviceloglines+10) {
        const rCount = dobj.innerLog.length - this.deviceloglines;

        dobj.innerLog.splice(0, rCount); // 11 записей за раз?
        if (!this.removedLines[did]) this.removedLines[did] = 0;
        this.removedLines[did] += rCount;

        // Удалить из БД - если удалено столько же сколько сохранено (удвоилось)
        if (this.removedLines[did] >  this.deviceloglines) {
          this.removedLines[did] = 0;
          this.holder.deleteLog('devicelog',{ts:dobj.innerLog[0].ts, where:[{name:'did', val:did}]});
        }
      }

      // dobj.addToInnerLog(logObj);
    
      this.holder.addLog('devicelog', { did, ...logObj });
    }
  },

  // Записать в mainloglog, генерировать событие для подписки
  logMain(logObj) {

    this.holder.addLog('mainlog', { ...logObj });
  },

  // Заполнение innerLog устройства при первом показе данными из таблицы devicelog (до перезагрузки)
  async fillInnerLogFromTable(did) {
    return deviceutil.fillInnerLogFromTable(did, this.holder);
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
