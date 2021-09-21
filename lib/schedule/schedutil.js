/**
 * schedutil.js
 */

const util = require('util');
const suncalc = require('suncalc');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

exports.getTimeForRule = getTimeForRule;
exports.checkRule = checkRule;
exports.getTime = getTime;
exports.calcTimerQts = calcTimerQts;
exports.checkTime = checkTime;
exports.checkDates = checkDates;
exports.getScheduleTriggers = getScheduleTriggers;

const predefined = ['minutely', 'hourly', 'daily', 'monthly', 'yearly'];

function getTimeForRule(rule) {
  if (typeof rule == 'string') {
    const name = rule;
    const location = name.startsWith('sun') ? appconfig.getLocation() : '';
    return getTime(name, '', location);
  }

  if (typeof rule == 'object' && rule.when) {
    if (predefined.includes(rule.when)) {
      return getPredefinedTime(rule.when);
    }

    if (rule.when.startsWith('sun')) {
      let hh = 0;
      let mm = 0;
      if (rule.shift) {
        [hh, mm] = parseTimeStr(rule.shift);
      }
      const cdate = calcSunTimeDate(rule.when, findDate(getNearestSun(rule.when, hh, mm), rule), hh, mm);
      let ts = cdate.getTime();
      return ts > Date.now() ? ts : 0;
    }
    if (rule.when == 'intime') {
      return calcTimerQts({ ...rule, whenId: 0 });
    }
  }
}

function checkRule(rule) {
  // when => not empty
  // when = intime => timehhmm;
  // everyday || dates || weekdays
  // what => not empty
  // what = scene => scene not empty
  // console.log('checkRule '+util.inspect(rule));

  if (!rule.everyday && !rule.weekdays && !rule.dates) throw { message: 'Ежедневно или выберите дни' };
  if (!rule.when == 'intime' && !rule.timehhmm) throw { message: 'Время не определено' };
  console.log('checkRule OK');
}

/**
 *
 * @param {String} name
 * @param {Date | timestamp | 'today' | 'tomorrow' | undefined} date - для  sunrise | sunset
 * @return {timestamp}
 */
function getTime(name, date, location) {
  return name == 'sunrise' || name == 'sunset' || predefined.includes(name)
    ? getPredefinedTime(name, date, location)
    : getCronTime(name);
}

function getPredefinedTime(name, date, location) {
  const dt = new Date();
  let res;
  if (name == 'sunrise' || name == 'sunset') {
    res = getSunTime(name, date || dt, location); //
  } else {
    res = getCalendarTime(name, dt).getTime();
  }
  // console.log('getPredefinedTime ='+res+' dt.getTime()='+dt.getTime())
  return res > dt.getTime() ? res : 0;
}

// Для данного ts определить, является ли эта временная точка другой предопределенной точкой
// Если это граница минуты - то часа, дня, месяца, года
// Если это граница часа - то дня, месяца, года
// Только для предопределенных календарных правил
function getScheduleTriggers(name, ts) {
  if (!predefined.includes(name)) return [name];

  const dt = new Date(ts);
  const res = [];
  if (dt.getSeconds() == 0) {
    // Только в этом случае будет какая-то граница
    res.push('minutely');
    if (dt.getMinutes() == 0) {
      res.push('hourly');
      if (dt.getHours() == 0) {
        res.push('daily');
        if (dt.getDay() == 1) {
          res.push('monthly');
          if (dt.getMonth() == 1) {
            res.push('yearly');
          }
        }
      }
    }
  }

  // Искать основной триггер, начать с него
  const idx = res.indexOf(name);
  return idx >= 0 ? res.slice(idx) : [name]; // Такого в принципе не должно быть? Только если время разбежалось
}

function getCronTime(cronStr) {
  try {
    const parser = require('cron-parser');
    const interval = parser.parseExpression(cronStr);
    const result = new Date(interval.next()).getTime(); // Sat Mar 06 2021 11:28:00 GMT+0300 (GMT+03:00)
    return result;
  } catch (err) {
    console.log('ERROR: cron-parser for ' + cronStr + ': ' + err.message);
    return 0;
  }
}
/**
 * Возвращает время восхода/заката для заданной локации
 * @param {String} name  'sunrise'| 'sunset' - если не задано - вернет 0
 *
 * @param {Date | String | Number | undefined} date - на дату
 *      Варианты: 'today', 'tomorrow'
 *                 объект типа Date
 *                 timestamp
 *
 * @param {*} location {lat, lng} - если не задано - вернет 0
 *
 * @return {number} timestamp || 0
 */
function getSunTime(name, date, location) {
  if (!location )  location = appconfig.getLocation();
  console.log('getSunTime location=' + util.inspect(location));
  if (!location || !location.lat || !location.lng) {
    console.log('WARN: Location not set! It is impossible to find out the time of ' + name);
    return 0;
  }

  try {
    let getDate = hut.getThisDate(date); // Возвращает объект Date для различных входных значений

    let suntimes = suncalc.getTimes(getDate, location.lat, location.lng);
    console.log('getSunTime suntimes=' + util.inspect(suntimes));

    console.log('getSunTime suntimes[name].getTime()=' + suntimes[name].getTime());

    return suntimes[name] ? suntimes[name].getTime() : 0;
  } catch (e) {
    console.log('ERROR: getSunTime ' + util.inspect(e));
    return 0;
  }
}

// monthly, daily, hourly, minutely
function getCalendarTime(name, dt) {
  let xmin = dt.getMinutes();
  let xhour = dt.getHours();
  let xdate = dt.getDate();
  let xmonth = dt.getMonth();

  if (name == 'minutely') {
    xmin += 1;
  } else if (name == 'hourly') {
    xmin = 0;
    xhour += 1;
  } else if (name == 'daily') {
    xmin = 0;
    xhour = 0;
    xdate += 1;
  } else if (name == 'monthly') {
    xmin = 0;
    xhour = 0;
    xdate = 1;
    xmonth += 1;
  } else if (name == 'yearly') {
    xmin = 0;
    xhour = 0;
    xdate = 1;
    xmonth = 1;
  }
  return new Date(dt.getFullYear(), xmonth, xdate, xhour, xmin, 0, 0);
}

function calcTimerQts(item) {
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let sun;
  let cdate;
  console.log('calcTimerQts item=' + util.inspect(item));

  try {
    switch (Number(item.whenId)) {
      case 0: // В заданное время
        [hh, mm] = parseTimeStr(item.timehhmm);
        cdate = findDate(getNearest(hh, mm), item);
        break;

      case 1: // Рассвет - закат
      case 2:
        sun = item.whenId == 1 ? 'sunrise' : 'sunset';
        if (item.shift) {
          [hh, mm] = parseTimeStr(item.shift);
        }
        cdate = calcSunTimeDate(sun, findDate(getNearestSun(sun, hh, mm), item), hh, mm);
        break;

      case 3: // Циклически
        [hh, mm, ss] = parsePeriodStr(item.period);
        // пока просто добавить к текущему времени без учета дней
        cdate = calcCyclic(hh, mm, ss);
        break;
      default:
    }

    if (cdate > 0) {
      let ts = cdate.getTime();
      return ts > Date.now() ? ts : 0;
    }
  } catch (e) {
    console.log('ERR: schedutils.calcTimerQts: ' + e.message);
    return 0;
  }
}

// 00:00
function parseTimeStr(str) {
  if (!str) throw { message: 'Empty time ' + str };
  let arr = str.split(':');
  if (arr.length != 2) throw { message: 'Invalid time ' + str };
  let koef = arr[0].substr(0, 1) == '-' ? -1 : 1;

  return [Number(arr[0]), Number(arr[1]) * koef];
}

// 00:00:00
function parsePeriodStr(str) {
  if (!str) throw { message: 'Empty period ' + str };
  let arr = str.split(':');
  if (arr.length != 3) throw { message: 'Invalid period ' + str };

  return [Number(arr[0]), Number(arr[1]), Number(arr[2])];
}

function calcCyclic(hh, mm, ss) {
  let ts = Date.now();
  ts += (hh * 3600 + mm * 60 + ss) * 1000;
  return new Date(ts);
}

// Найти подходящую дату по времени - сегодня или завтра
function getNearest(hh, mm) {
  let dt = new Date();
  dt.setHours(hh);
  dt.setMinutes(mm);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  if (dt < new Date()) dt.setDate(dt.getDate() + 1);
  return dt;
}

// Найти подходящую дату по времени закат/восход с учетом сдвига!! - сегодня или может уже завтра
// для завтра время потом будет уточнено
function getNearestSun(sun, hh, mm) {
  let dt = new Date(getSunTime(sun));
  dt.setHours(dt.getHours() + hh);
  dt.setMinutes(dt.getMinutes() + mm);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  if (dt < new Date()) dt.setDate(dt.getDate() + 1);
  return dt;
}

function calcSunTimeDate(sun, dt, hh, mm) {
  dt = new Date(getSunTime(sun, dt));
  dt.setHours(dt.getHours() + hh);
  dt.setMinutes(dt.getMinutes() + mm);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  return dt;
}

// найти подходящий день начиная с startdt
function findDate(startdt, item) {
  if (item.weekdays) {
    return getDateForDaysOfWeek(startdt, weekDaysArray(item));
  }

  // По заданному шаблону
  if (item.dates) return getDateForTemplate(startdt, item.dates);

  // Ежедневно
  return startdt;
}

function weekDaysArray(item) {
  const res = [];
  // week_1 - week_7
  for (let i = 1; i <= 7; i++) {
    if (item['week_' + i]) res.push(String(i));
  }
  return res;
}

// Стандартный getDay() возвращает воскресенье=0. getOurDay воскресенье=7
function getOurDay(dt) {
  let day = dt.getDay();
  if (day == 0) day = 7;
  return String(day);
}

function getDateForDaysOfWeek(startdt, days) {
  let dt = startdt;
  let daySet = new Set(days);

  for (let i = 0; i < 7; i++) {
    if (daySet.has(getOurDay(dt))) return dt;
    dt.setDate(dt.getDate() + 1);
  }
  console.log('ERROR: Schedutils.getDateForDaysOfWeek Not found week day for ' + JSON.stringify(days));
}

function getDateForTemplate(startdt, datestr) {
  try {
    checkDates(datestr);

    let arr = datestr.split('.');
    let dt = new Date(startdt);

    let dd = Number(arr[0]) || 0;
    let mm = Number(arr[1]) || 0;
    let yy = Number(arr[2]) || 0;

    if (dd > 0) {
      const lastDay = getLastDayOfMonth(dt.getYear(), dt.getMonth());
      if (lastDay < dd) {
        dt.setMonth(dt.getMonth() + 1);
      }
      dt.setDate(dd);
      if (dt < startdt) dt.setMonth(dt.getMonth() + 1);
    }

    if (mm > 0) {
      dt.setMonth(mm - 1);
      if (dt < startdt) {
        if (!yy) dt.setFullYear(dt.getFullYear() + 1);
      }
    }

    return dt.getTime() > Date.now() ? dt : 0;
  } catch (e) {
    console.log('ERROR: Schedutils.getDateForTemplate for ' + JSON.stringify(datestr) + ' : ' + e.message);
  }
}

function getLastDayOfMonth(year, month) {
  let date = new Date(year, month + 1, 0);
  return date.getDate();
}

function checkTime(timehhmm) {
  let res = /^[+-]*(\d\d):(\d\d)$/.exec(timehhmm);
  if (!res) throw { message: appconfig.getMessage('INVALIDTIME') + '!' };
  if (res[1] > 23) throw { message: appconfig.getMessage('INVALIDTIME') + ' (' + appconfig.getMessage('hour') + ')' };
  if (res[2] > 59)
    throw { message: appconfig.getMessage('INVALIDTIME') + ' (' + appconfig.getMessage('minutes') + ')' };
}

function checkDates(dates) {
  let resd = /^([0-9*]+)\.([0-9*]+)\.([0-9*]+)$/.exec(dates);

  if (!resd) throw { message: errMessage('INVALIDDATE') };
  if (resd[1] > 31) throw { message: errMessage('INVALIDDATE', 'day') };
  if (resd[2] > 12) throw { message: errMessage('INVALIDDATE', 'month') };

  if (resd[3].length < 4 && (resd[3] < 18 || resd[3] > 28)) throw { message: errMessage('INVALIDDATE', 'year') };
  if (resd[3].length >= 4 && (resd[3] < 2018 || resd[3] > 2028)) throw { message: errMessage('INVALIDDATE', 'year') };
}

function errMessage(part1, part2) {
  let mess = appconfig.getMessage(part1);
  mess += part2 ? ' (' + appconfig.getMessage(part2) + ')' : '';
  return mess + '!';
}
