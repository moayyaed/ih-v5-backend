/*
 * timers.js - Объект для управления массивом таймеров
 *  В отличие от timermanager - таймеры записываются в один отсортированный массив
 *  timers - массив таймеров
 *  Элемент массива {tname, owner, sts, qts}
 *       - qts - целевой ts
 *   - при добавлении таймер вставляется в массив с учетом сортировки (addTimer)
 *   - проверка сработки поверяет только первые элементы
 *
 *  При сработке таймера генерируется событие ready c объектом таймера {tname, owner, sts, qts }
 */

const EventEmitter = require('events');

class Timers extends EventEmitter {
  constructor(interval, timerArr) {
    super();

    interval = interval || 1; // м.б. в десятых секунды =0.1

    this.timers = Array.isArray(timerArr) ? timerArr : [];

    this.interval = setInterval(() => this.getRoundTimers(), interval * 1000);
  }

  getRoundTimers() {
    const curtime = Date.now();
    while (this.timers.length > 0 && checkTimer(curtime, this.timers[0].qts)) {
      this.emit('ready', this.timers.shift());
    }
  }

  /**
   * Добавить новый таймер с учетом сортировки
   *   item: {tname, owner, qts}
   */
  addTimer(item) {
    if (!item || !item.tname || !item.qts) return;

    item.sts = Date.now();
    let i = 0;
    while (i < this.timers.length) {
      if (this.timers[i].qts > item.qts) {
        this.timers.splice(i, 0, item);
        return item;
      }
      i++;
    }
    this.timers.push(item);
    return item;
  }

  deleteTimer({ tname, owner }) {
    for (let i = 0; i < this.timers.length; i++) {
      if (this.timers[i].tname == tname && this.timers[i].owner == owner) {
        this.timers.splice(i, 1);
        return;
      }
    }
  }
}

const checkTimer = (curtime, qtime) => qtime <= curtime;

module.exports = Timers;
