/**
 * devicelogger.js
 * Вызывается как самостоятельный объект, holder внутри
 */

// const util = require('util');

const appconfig = require('../appconfig');
const deviceutil = require('./deviceutil');
const logconnector = require('../log/logconnector');

module.exports = {
  start(holder) {
    this.holder = holder;
    this.devInnerLog = {};

    this.removedLines = {};
    this.deviceloglines = appconfig.get('deviceloglines') || 100;
  },

  addFirst(did, dataObj) {
    this.devInnerLog[did] = [];
    const innerLog = this.devInnerLog[did];

    if (typeof dataObj == 'object') {
      Object.keys(dataObj).forEach(prop => {
        innerLog.push({ did, prop, val: dataObj[prop].val, ts: dataObj[prop].ts, boot: 1 });
      });
    }
    // Сформировать пустую запись в журнале, которая указывает позицию записей после загрузки
    if (!innerLog.length) innerLog.push({ boot: 1 });
  },

  addLog(did, logObj) {
    const dobj = did ? this.holder.devSet[did] : '';
    if (!dobj) return [];

    const innerLog = this.devInnerLog[did];
    if (!innerLog) this.devInnerLog[did] = [];

    const data = [deviceutil.getLogTitleAndMessage(dobj, logObj)];
    this.holder.emit('devicelog', { did, data });

    // Сохранить в журнале устройства
    innerLog.push({ did, ...logObj });
    // Удалить записи, если уже больше (+10?)
    if (innerLog.length > this.deviceloglines + 10) {
      const rCount = innerLog.length - this.deviceloglines;

      innerLog.splice(0, rCount); // 11 записей за раз?
      if (!this.removedLines[did]) this.removedLines[did] = 0;
      this.removedLines[did] += rCount;

      // Удалить из БД - если удалено столько же сколько сохранено (удвоилось)
      if (this.removedLines[did] > this.deviceloglines) {
        this.removedLines[did] = 0;
        logconnector.deleteLog('devicelog', { ts: innerLog[0].ts, where: [{ name: 'did', val: did }] });
      }
    }

    logconnector.addLog('devicelog', { did, ...logObj });
  },

  async getLog(did, reverse) {
    const innerLog = this.devInnerLog[did];
    if (!innerLog || !innerLog.length) return [];
   


    if (innerLog.length < 90 && innerLog[0].boot) {
      // Загрузить первый раз из таблицы
      await this.fillInnerLogFromTable(did);
    }
    const res = [...innerLog];
    return reverse ? res.reverse() : res;
  },

  async fillInnerLogFromTable(did) {
    const innerLog = this.devInnerLog[did];

    if (!innerLog || !innerLog.length || !innerLog[0].boot) return []; // Устройство только что создано или уже много записей??

    // Первые записи - boot -> из таблицы данные еще не брались
    const bootTs = this.holder.system.bootTs;
    const arr = await logconnector.getLog(
      'devicelog',
      { did, ts: { $lt: bootTs } },
      { limit: 100 - innerLog.length, sort: { ts: -1 } }
    );

    const bootCount = countBoot();
    if (arr.length) {
      // Если записи в журнале есть - добавить в начало массива А boot записи удалить
      innerLog.splice(0, bootCount, ...arr.reverse()); // Данные пришли в обратном порядке (desc)
    } else if (innerLog[0].prop) {
      // Возможно, записей в журнале нет (уже удалены) - оставить данные отпечатка но сбросить boot флаг.
      for (let i = 0; i < bootCount; i++) {
        innerLog[i].boot = 0;
      }
    } else {
      // Если данных отпечатка не было - удалить из массива первую запись
      innerLog.shift();
    }

    function countBoot() {
      let count = 0;
      for (let i = 0; i < innerLog.length; i++) {
        if (!innerLog[i].boot) break;
        count++;
      }
      return count;
    }
  }
};
