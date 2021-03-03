/**
 * agent.js
 *
 * Agent for devo instances
 *  - emits via holder
 *  - works with device timers
 */

const util = require('util');

const deviceutil = require('./deviceutil');
const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  writeDeviceChannel(did, sendObj) {
    console.log('agent.writeDeviceChannel ' + util.inspect(sendObj));
    // this.holder.emit('write:plugin', sendObj);
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

  // Заполнение журнала устройства при первом показе (запросе) данными из таблицы devicelog данными до перезагрузки
  async fillInnerLogFromTable(did) {
    const dobj = this.holder.devSet[did];

    if (!dobj.innerLog.length || !dobj.innerLog[0].boot) return []; // Устройство только что создано или уже много записей??

    // Первые записи - boot -> из таблицы данные еще не брались
    const bootTs = this.holder.system.bootTs;
    const arr = await this.holder.dm.getLog('devicelog', { did, ts: { $lt: bootTs } }, { limit: 100 });
   
    const bootCount = countBoot();
    if (arr.length) {
      // Если записи в журнале есть - добавить в начало массива А boot записи удалить
      dobj.innerLog.splice(0, bootCount, ...arr);
    } else if (dobj.innerLog[0].prop) {
      // Возможно, записей в журнале нет (уже удалены) - оставить данные отпечатка но сбросить boot флаг.
      for (let i = 0; i < bootCount; i++) {
        dobj.innerLog[i].boot = 0;
      }
    } else {
      // Если данных отпечатка не было - удалить из массива первую запись
      dobj.innerLog.shift();
    }

    function countBoot() {
      let count = 0;
      for (let i = 0; i < dobj.innerLog.length; i++) {
        if (!dobj.innerLog[i].boot) break;
        count++;
      }
      return count;
    }
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
