/**
 * scheduler.js
 *  Генерирует события для расписания
 */

const Timers = require('../utils/timers');
const schedutil = require('./schedutil');

module.exports = async function(holder) {
  // Запустить механизм таймеров c мин интервалом 1 сек для таймеров расписания
  const sctm = new Timers(1);

  // Добавить системные таймеры - пока так
  sctm.addTimer({ tname: 'minutely', owner: 'sys', qts: schedutil.getSysTime('minutely') });
  sctm.addTimer({ tname: 'hourly', owner: 'sys', qts: schedutil.getSysTime('hourly') });
  sctm.addTimer({ tname: 'daily', owner: 'sys', qts: schedutil.getSysTime('daily') });
  sctm.addTimer({ tname: 'monthly', owner: 'sys', qts: schedutil.getSysTime('monthly') });

  // Добавить для расписания и для сценариев? - нестандартные считать

  sctm.on('ready', onScheduleReady);

  // Отработка событий таймеров расписания
  function onScheduleReady(timeobj) {
    if (timeobj && timeobj.owner) {
      if (timeobj.owner == 'sys') {
        holder.emit('scheduler', timeobj.tname); //
        sctm.addTimer({ tname: timeobj.tname, owner: 'sys', qts: schedutil.getSysTime(timeobj.tname) });
      }
    }
  }
};
