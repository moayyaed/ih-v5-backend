/**
 * schedengine.js
 *
 * Отработка расписания, созданного в системе - таблица schedrule
 *  таблица schedcurrent хранит оперативные данные для каждого пункта расписания (было выполнено/будет выполнено)
 *
 *  Добавляет таймеры в sctm и сохраняет в таблицу schedcurrent
 *  Отрабатывает действия по своему расписанию, которые вызывает sheduler в onScheduleReady (owner:'sched006') - конкретный пункт
 *  Перевзводит таймер и запись в schedcurrent - хранит данные для каждого пункта расписания)
 *
 */

const util = require('util');

// const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const schedutils = require('./schedutil');

class Schedengine {
  constructor(holder, timermanger) {
    this.holder = holder;
    this.dm = holder.dm;
    this.timermanger = timermanger;

    this.schedSet = {};
  }

  start() {}

  /**
   * Создание пункта расписания
   *  - Вычислить время запуска
   *  - Взвести таймер
   *  -
   * @param {String} id
   * @param {Object} doc
   */
  addItem(id, doc, recCurrent) {
    // console.log('schedule addItem id=' + id + ' doc= ' + util.inspect(doc) + ' recCurrent=' + recCurrent);
    this.schedSet[id] = doc;

    this.schedSet[id].laststart_ts = recCurrent && recCurrent.l_ts > 0 ? recCurrent.l_ts : '';

    try {
      if (doc.blk) {
        this.schedSet[id].willstart_ts = appconfig.getMessage('Blocked');
      } else {
        schedutils.checkRule(doc);
        this.startTimer(id);
      }
      this.schedSet[id].errstr = '';
    } catch (e) {
      this.schedSet[id].errstr = e.message;
    }
    this.fixCurrnent(id);
  }

  updateItem(id, doc) {
    // Сбросить таймер текущий
    this.timermanger.deleteTimer({ tname: id, owner: id });
    const l_ts = this.schedSet[id] ? this.schedSet[id].laststart_ts : '';
    this.addItem(id, doc, { l_ts });
  }

  removeItem(id) {
    // Сбросить таймер текущий
    this.timermanger.deleteTimer({ tname: id, owner: id });
    this.schedSet[id] = '';
    this.dm.removeDocs('schedcurrent', [{ _id: id }]);
  }

  startTimer(id) {
    const qts = schedutils.getTimeForRule(this.schedSet[id]);
    //
    if (qts) {
      this.timermanger.addTimer({ tname: id, owner: id, qts });
    }
    this.schedSet[id].willstart_ts = qts;
    return qts;
  }

  fixCurrnent(id) {
    this.dm.upsertDocs('schedcurrent', [
      {
        _id: id,
        w_ts: this.schedSet[id].willstart_ts,
        l_ts: this.schedSet[id].laststart_ts,
        errstr: this.schedSet[id].errstr
      }
    ]);
  }

  // Выполнить действие по расписанию, перезапустить таймер
  exec(timeobj) {
    // console.log('schedule exec timeobj= ' + util.inspect(timeobj));

    const id = timeobj.tname;
    this.schedSet[id].laststart_ts = Date.now(); // Фактически выполнено

    // Запустить действие
    this.doActions(id);

    // Перевзвести таймер
    this.startTimer(id);

    // Фиксировать - было, будет
    this.fixCurrnent(id);
  }

  doActions(id) {
    const rule = this.schedSet[id];
    const sender = 'Scheduler: ' + id;
    if (rule.what == 'scene') {
      const sceneId = rule.scene;
      if (sceneId) {
        this.holder.deviceWorker.postMessage({
          name: 'start:scene',
          data: { id: sceneId, arg: '', sender }
        });
      }
    } else if (rule.what == 'devcmd') {
      const did = rule.did;
      const prop = rule.prop;
      if (did && prop) {
        this.holder.deviceWorker.postMessage({ name: 'exec:device:command', data: { did, prop, sender } });
      }
    }
  }
}

module.exports = Schedengine;
