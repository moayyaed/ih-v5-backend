/*
 * extimermanager.js - Объект для управления таймерами
 *
 *  Контролирует, чтобы для одного owner+tname в один момент был единственный таймер
 *  Дает возможность перевзвести таймер или дать досчитать при повторных setTimer в зависимости от флага
 *
 *  При сработке таймера генерирует событие 'ready' c объектом таймера {callback, tname:'T1', owner:'scen1', sts:ts, qts:ts }
 *
 *
 *  API модуля:
 *   setTimer({ owner, tname, interval, restart }[, callback])
 *   clearTimer({ owner, tname [, interval]})
 *   deleteAllTimers({ owner, tname })
 *
 *  Структуры модуля:
 *   timers[tick] =[] - набор масивов таймеров
 *     Каждый массив хранит таймеры одного временного интервала, поэтому сортировка не требуется
 *     - добавление всегда делается в конец массива
 *     - проверка сработки поверяет только первые элементы
 *     Временной интервал хранится в десятых секунды, настройка таймеров - в секундах (0.1 сек=>1, 1 сек=>10, 1.5 сек=>15)
 *     Дискрета таймера - 100 мсек
 *
 *   timerMap Map [owner1.t1:10, ..]- массив ключ:tick текущих таймеров  - для контроля уникальности
 */

const EventEmitter = require('events');

class Timerman extends EventEmitter {
  constructor(interval) {
    super();

    this.timers = {};
    this.timerMap = new Map();
    interval = interval || 1; // м.б. в десятых секунды =0.1
    this.interval = setInterval(() => this._getRoundTimers(), interval * 1000);
  }

  /**
   * Установка таймера
   * @param {Object}
   *           {String} owner
   *           {String} tname
   *           {Number} interval
   *           {Bool} restart = true Если таймер уже взведен - взводит повторно. Иначе не взводит (startTimer)
   *
   * @param {Function} callback
   */
  setTimer({ owner, tname, interval, restart }, callback = '') {
    const key = owner + '.' + tname;

    if (this.timerMap.has(key)) {
      if (!restart) return; // Время проверить??

      this.clearTimer(owner, tname);
    }

    return this._addTimer({ owner, tname, interval, callback });
    // TODO ??? Возможно, нужно сохранять взведенные таймеры между перезагрузками сервера
  }

  /**
   * Добавить новый таймер в массив
   * @param {Object}  { owner, tname, callback, interval}
   * @return {Object} { owner, tname, callback, sts, qts }
   */
  _addTimer(inObj) {
    const { owner, tname, interval } = inObj;
    const tick = getTick(interval);
    if (!tick) return;

    this.timerMap.set(owner + '.' + tname, tick);

    const ct = Date.now();
    if (!this.timers[tick]) this.timers[tick] = [];
    const item = { ...inObj, sts: ct, qts: ct + tick * 100 };
    this.timers[tick].push(item);
    return item;
  }

  clearTimer(owner, tname) {
    const key = owner + '.' + tname;
    if (this.timerMap.has(key)) {
      const tick = this.timerMap.get(key);
      this._deleteTimer(tick, { owner, tname });
      this.timerMap.delete(key);
    }
  }

  /**
   * Удалить таймер из массива, известен интервал
   *
   */
  _deleteTimer(tick, { owner, tname }) {
    if (!tick || !this.timers[tick]) return;

    for (let i = 0; i < this.timers[tick].length; i++) {
      let item = this.timers[tick][i];
      if (item.owner == owner && item.tname == tname) {
        this.timers[tick].splice(i, 1);
        return;
      }
    }
  }

  _getRoundTimers() {
    if (!this.timerMap.size) return; // Нет взведенных таймеров

    const curtime = Date.now();
    Object.keys(this.timers).forEach(tick => {
      while (this.timers[tick].length > 0 && checkTimer(curtime, this.timers[tick][0].qts)) {
        const one = this.timers[tick].shift();
        this.timerMap.delete(one.owner + '.' + one.tname);
        this.emit('ready', { ...one });
      }
    });
  }
}

/**
 *
 * @param {Number || String} sek - время в секундах, м.б. дробное - считаем в десятых секунды; остальное округляется
 */
const getTick = sek => {
  const res = Number(sek);
  return res > 0 ? String(Math.round(res * 10)) : 0;
};

const checkTimer = (curtime, qtime) => qtime <= curtime;

module.exports = Timerman;
