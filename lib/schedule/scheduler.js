/**
 * scheduler.js
 *  Генерирует события для расписания
 */

const Timers = require('../utils/timers');
const schedutil = require('./schedutil');

module.exports = async function(holder) {
  // Запустить механизм таймеров c мин интервалом 1 сек для таймеров расписания
  const sctm = new Timers(1);

  const points = {};  // {"* 0 * * *":5, "sunset":1,..}

  // Добавить системные таймеры - пока так
  /*
  sctm.addTimer({ tname: 'minutely', owner: 'sys', qts: schedutil.getSysTime('minutely') });
  sctm.addTimer({ tname: 'hourly', owner: 'sys', qts: schedutil.getSysTime('hourly') });
  sctm.addTimer({ tname: 'daily', owner: 'sys', qts: schedutil.getSysTime('daily') });
  sctm.addTimer({ tname: 'monthly', owner: 'sys', qts: schedutil.getSysTime('monthly') });
  */

  // Принимать правило для включения в расписание  (от движков сценариев, устройств, плагинов, ...)
  // Не храним, кто запросил, просто счетчики

  holder.on('schedule:include', (cronStr) => {
    console.log('ON schedule:include '+cronStr);
    if (!points[cronStr]) {
      points[cronStr] = 0;
      sctm.addTimer({ tname: cronStr, owner: 'sys', qts: schedutil.getTime(cronStr) });
      console.log('ADD TIMER '+cronStr)
    }
    points[cronStr] += 1;
  });

  holder.on('schedule:exclude', (cronStr) => {
    if (points[cronStr]>0) {
      points[cronStr] -= 1;
    }
    // Не удаляю, просто счетчик 0?
  });

  sctm.on('ready', onScheduleReady);

  // Отработка событий таймеров расписания
  function onScheduleReady(timeobj) {
    if (timeobj && timeobj.tname && points[timeobj.tname]) {

        holder.emit('scheduler:ready', timeobj.tname); // таймер сработал и есть подписчики
        sctm.addTimer({ tname: timeobj.tname, owner: 'sys', qts: schedutil.getTime(timeobj.tname) });
    }
  }
};
