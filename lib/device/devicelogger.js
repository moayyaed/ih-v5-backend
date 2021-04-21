/**
 * devicelogger.js
 * Вызывается как самостоятельный объект, holder внутри
 */

const util = require('util');

const appconfig = require('../appconfig');
const deviceutil = require('./deviceutil');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.devInnerLog = {};

    this.removedLines = {}; 
    this.deviceloglines = appconfig.get('deviceloglines') || 100;
  },

  log(logObj) {
    console.log('logDevice '+util.inspect(logObj))
    const did = logObj.did;

    const dobj = did ? this.holder.devSet[did] : '';
    if (!dobj) return [];

    const innerLog = this.devInnerLog[did];
    if (!innerLog) this.devInnerLog[did] = [];

    const data = [deviceutil.getLogTitleAndMessage(dobj, logObj)];
    this.holder.emit('devicelog', { did, data });

    // Сохранить в журнале устройства
    innerLog.push({ did, ...logObj });
    // console.log('devicelog did='+util.inspect(logObj)+' dobj.innerLog.length='+dobj.innerLog.length)

    // Удалить записи, если уже больше (+10?)
    if (innerLog.length > this.deviceloglines + 10) {
      const rCount = innerLog.length - this.deviceloglines;

      innerLog.splice(0, rCount); // 11 записей за раз?
      if (!this.removedLines[did]) this.removedLines[did] = 0;
      this.removedLines[did] += rCount;

      // Удалить из БД - если удалено столько же сколько сохранено (удвоилось)
      if (this.removedLines[did] > this.deviceloglines) {
        this.removedLines[did] = 0;
        this.holder.logconnector.deleteLog('devicelog', { ts: innerLog[0].ts, where: [{ name: 'did', val: did }] });
      }
    }

    this.holder.logconnector.addLog('devicelog', { did, ...logObj });
  }

}

