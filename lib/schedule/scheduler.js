/**
 * scheduler.js
 * 
 * Запускает механизм таймеров c мин интервалом 1 сек для всех таймеров расписания
 * 
 * Запускает schedengine, schedmate
 *   schedengine - Отрабатывает действия по  расписанию, созданному в системе - таблица schedrule
 *   schedmate - Слушает события изменения schedrule (добавление, удаление, блокировка, изменение условий)
 *
 *
 *  Принимает подписку для включения в расписание от других компонентов системы (от движков устройств, плагинов, ...)
 *                    для включения  'schedule:include',
 *                    для исключения 'schedule:exclude',
 *             параметр -строка <ruleStr || sunset/sunrize || minutely/hourly/daily/monthly/yearly>
 *
 *  Генерирует события для расписания  'scheduler:ready' - одно для всех подписчиков со стороны (owner:sys)
 *
 */

const util = require('util');

const appconfig = require('../appconfig');
const Timers = require('../utils/timers');
const schedutil = require('./schedutil');

const Schedengine = require('./schedengine');
const Schedmate = require('./schedmate');

module.exports = async function(holder) {
  // Запустить механизм таймеров 
  const sctm = new Timers(0.5);

  const points = {}; // правило:число подписок - {"* 0 * * *":5, "sunset":1,..}

  const engine = new Schedengine(holder, sctm);
  const mate = new Schedmate(engine);

  const schedruleDocs = (await holder.dm.dbstore.get('schedrules')).filter(doc => doc._id && !doc.folder);

  for (const doc of schedruleDocs) {
    const id = doc._id;
    const rec =  await holder.dm.findRecordById('schedcurrent', id);

    engine.addItem(id, doc, rec);
  }

  engine.start();
  mate.start();
  console.log('INFO: Schedule engine has started');

  // Принимать правило для включения в расписание от других компонентов системы
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
    // console.log('onScheduleReady '+util.inspect(timeobj))
    if (timeobj.owner == 'sys') {
      if (timeobj && timeobj.tname && points[timeobj.tname] > 0) {
        const triggers = schedutil.getScheduleTriggers(timeobj.tname, timeobj.qts);
        holder.emit('schedule:ready', timeobj.tname, triggers); // таймер сработал и есть подписчики
        const qts = getTime(timeobj.tname);
        sctm.addTimer({ tname: timeobj.tname, owner: 'sys', qts });
        // console.log('ADD TIMER '+timeobj.tname+' on '+new Date(qts).toString())
      }
      return;
    }
    engine.exec(timeobj); // Выполнить действие по расписанию, перезапустить таймер
  }

  function getTime(name) {
    const location = name.startsWith('sun') ? appconfig.getLocation() : '';
    return schedutil.getTime(name, '', location);
  }
};
