/**
 * scheduler.js
 *
 *
 *  Принимает подписку для включения в расписание 'schedule:include',
 *                  для исключения из расписания  'schedule:exclude',
 *             параметр -строка <ruleStr || sunset/sunrize || minutely/hourly/daily/monthly/yearly>
 *
 *  Генерирует события для расписания  'scheduler:ready' - одно для всех подписчиков
 *
 */

const appconfig = require('../appconfig');
const Timers = require('../utils/timers');
const schedutil = require('./schedutil');

module.exports = async function(holder) {
  // Запустить механизм таймеров c мин интервалом 1 сек для таймеров расписания
  const sctm = new Timers(0.5);

  const points = {}; // правило:число подписок - {"* 0 * * *":5, "sunset":1,..}

  // Принимать правило для включения в расписание  (от движков сценариев, устройств, плагинов, ...)
  // Не храним, кто запросил, просто счетчики

  holder.on('schedule:include', ruleStr => {
    if (!points[ruleStr]) {
      points[ruleStr] = 0;
      const qts = getTime(ruleStr);
      // console.log('schedule:include '+ruleStr+' on '+new Date(qts).toString())
      sctm.addTimer({ tname: ruleStr, owner: 'sys', qts });
      // console.log('ADD TIMER '+ruleStr)
    }
    points[ruleStr] += 1;
  });

  holder.on('schedule:exclude', ruleStr => {
    // console.log('schedule:exclude '+ruleStr)
    if (points[ruleStr] > 0) {
      points[ruleStr] -= 1;
    }
    // Не удаляю, просто счетчик 0?
  });

  sctm.on('ready', onScheduleReady);

  // Отработка событий таймеров расписания
  function onScheduleReady(timeobj) {
    if (timeobj && timeobj.tname && points[timeobj.tname] > 0) {
      const triggers = schedutil.getScheduleTriggers(timeobj.tname, timeobj.qts);
      holder.emit('schedule:ready', timeobj.tname, triggers); // таймер сработал и есть подписчики
      const qts = getTime(timeobj.tname);
      sctm.addTimer({ tname: timeobj.tname, owner: 'sys', qts });
      // console.log('ADD TIMER '+timeobj.tname+' on '+new Date(qts).toString())
    }
  }

  function getTime(name) {
    const location = name.startsWith('sun') ? appconfig.getLocation() : '';
    return schedutil.getTime(name, '', location);
  }
};
