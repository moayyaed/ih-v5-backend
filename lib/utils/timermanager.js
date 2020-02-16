/*
* timermanager.js - Объект для управления таймерами
*
*   timerSet - набор масивов таймеров 
*   Каждый массив хранит таймеры одного временного интервала, поэтому сортировка не требуется
*   - добавление всегда делается в конец массива
*   - проверка сработки поверяет только первые элементы  
*  Временной интервал хранится в десятых секунды, настройка таймеров - в секундах (0.1 сек=>1, 1 сек=>10, 1.5 сек=>15)
*
* При сработке таймера генерирует событие ready c объектом таймера {tname:'T1', owner:'scen1', sts:ts, qts:ts }
*/


const EventEmitter = require('events');

class Timerman extends EventEmitter {
  constructor(interval) {
    super();

  interval = interval || 1; // м.б. в десятых секунды =0.1
  
  this.timerSet = {};

  this.interval = setInterval(() => this.getRoundTimers(), interval * 1000);
  }

getRoundTimers() {
  let curtime = Date.now();
  Object.keys(this.timerSet).forEach(tick => {
    while (this.timerSet[tick].length > 0 && checkTimer(curtime, this.timerSet[tick][0].qts)) {
      this.emit('ready', this.timerSet[tick].shift());
    }
  });
}

/**
 * Добавить новый таймер
 *
 */
startTimer(interval, { owner, tname }) {
  let tick = getTick(interval);
  if (!tick) return;

  let ct = Date.now();
  if (!this.timerSet[tick]) this.timerSet[tick] = [];
  this.timerSet[tick].push({ owner, tname, sts: ct, qts: ct + tick * 100 });
  return { sts: ct, qts: ct + tick * 100 };
}

/**
 * Удалить таймер, известен интервал
 *
 */
deleteTimer(interval, { owner, tname }) {
  const tick = getTick(interval);
  if (!tick || !this.timerSet[tick]) return;

  for (let i = 0; i < this.timerSet[tick].length; i++) {
    let item = this.timerSet[tick][i];
    if (item.owner == owner && item.tname == tname) {
      this.timerSet[tick].splice(i, 1);
      return;
    }
  }
}

/**
 * Удалить все таймеры, запущенные для owner&tname
 *
 */
deleteAllTimers({ owner, tname }) {
  Object.keys(this.timerSet).forEach(tick => {
    for (let i = 0; i < this.timerSet[tick].length; i++) {
      let item = this.timerSet[tick][i];
      if (item.owner == owner && (!tname || item.tname == tname)) {
        this.timerSet[tick].splice(i, 1);
        return;
      }
    }
  });
}
}

/**
 *
 * @param {Number || String} sek - время в секундах, м.б. дробное - считаем в десятых секунды; остальное округляется
 */
const getTick = (sek)=>  {
  const res = Number(sek);
  return res > 0 ? String(Math.round(res * 10)) : 0;
}


const checkTimer = (curtime, qtime) => qtime <= curtime;

module.exports = Timerman;