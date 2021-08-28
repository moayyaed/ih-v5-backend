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
const schedutils = require('./schedutil');

class Schedengine {
  constructor(holder, timermanger) {
    this.holder = holder;
    this.dm = holder.dm;
    this.timermanger = timermanger;
  }

  start() {

  }

  /**
   * Создание пункта расписания 
   *  - Вычислить время запуска
   *  - Взвести таймер
   *  - 
   * @param {String} id 
   * @param {Object} doc 
   */
  addItem(id, doc) {
    console.log('schedule addItem id='+id+' doc= '+util.inspect(doc))
    const qts = schedutils.getTimeForRule(doc);
    // 
    if (qts) {
      this.timermanger.addTimer({ tname: id, owner: id, qts });
      this.dm.upsertDocs('schedcurrent', [{_id:id, willstart_ts: qts}]);
      console.log('QTS='+qts.toString())
    }
  }
}

module.exports = Schedengine;
