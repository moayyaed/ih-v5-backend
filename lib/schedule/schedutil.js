/**
 * schedutil.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

exports.getTime = getTime;
exports.calcTimerQts = calcTimerQts;
exports.checkTime = checkTime;
exports.checkDates = checkDates;

/**
 *
 * @param {String} name   sunrise | sunset | minutely | hourly | daily | monthly
 * @param {Date | timestamp | 'today' | 'tomorrow' | undefined} date - для  sunrise | sunset
 * @return {timestamp}
 */
function getTime(name, date) {
  const dt = new Date();
  let resDate = dt;
  if (name == 'sunrise' || name == 'sunset') {
    resDate = hut.getSunTime(name, date || dt, appconfig.getLocation()); //
  } else {
    resDate = getNext(name, dt);
  }
  return resDate > dt ? resDate.getTime() : 0;
}

// monthly, daily, hourly, minutely
function getNext(name, dt) {
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
  }
  return new Date(dt.getFullYear(), xmonth, xdate, xhour, xmin, 0, 0);
}

function calcTimerQts(item) {
  let hh = 0;
  let mm = 0;
  let ss = 0;
  let sun;
  let cdate;

  try {
    switch (Number(item.when)) {
      case 0: // В заданное время
        [hh, mm] = parseTimeStr(item.timehhmm);
        cdate = findDate(getNearest(hh, mm), item);
        break;

      case 1: // Рассвет - закат
      case 2:
        sun = item.when == 1 ? 'sunrise' : 'sunset';
        if (item.shift) {
          [hh, mm] = parseTimeStr(item.shift);
        }
        cdate = setSunTime(sun, findDate(getNearestSun(sun, hh, mm), item), hh, mm);
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
  let dt = new Date(getSysTime(sun));
  dt.setHours(dt.getHours() + hh);
  dt.setMinutes(dt.getMinutes() + mm);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  if (dt < new Date()) dt.setDate(dt.getDate() + 1);
  return dt;
}

function setSunTime(sun, dt, hh, mm) {
  dt = new Date(getSysTime(sun, dt));
  dt.setHours(dt.getHours() + hh);
  dt.setMinutes(dt.getMinutes() + mm);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  return dt;
}

// найти подходящий день начиная с startdt
function findDate(startdt, item) {
  if (util.isArray(item.days) && item.days.length > 0) {
    // Воскресенье теперь 0 а не 7
    for (let i = 0; i < item.days.length; i++) {
      if (item.days[i] == 7) item.days[i] = '0';
    }
    return getDateForDaysOfWeek(startdt, item.days);
  }

  if (item.dates) return getDateForTemplate(startdt, item.dates);

  return startdt;
}

// Стандартный getDay() возвращает воскресенье=0. getOurDay воскресенье=7
function getOurDay(dt) {
  let day = dt.getDay();
  // if (day == 0) day = 7;
  return String(day);
}

function getDateForDaysOfWeek(startdt, days) {
  let dt = startdt;
  let daySet = new Set(days);

  for (let i = 0; i < 7; i++) {
    if (daySet.has(getOurDay(dt))) return dt;
    dt.setDate(dt.getDate() + 1);
  }
  console.log('ERR: Schedutils.getDateForDaysOfWeek Not found week day for ' + JSON.stringify(days));
}

function getDateForTemplate(startdt, datestr) {
  try {
    checkDates(datestr);

    let arr = datestr.split('.');
    let dt = new Date(startdt);

    let dd = Number(arr[0]);
    let mm = Number(arr[1]);
    let yy = Number(arr[2]);
    if (yy < 2000) yy += 2000;

    if (dd > 0) {
      dt.setDate(dd);
      if (dt < startdt) dt.setMonth(dt.getMonth() + 1);
    }

    if (mm > 0) {
      dt.setMonth(mm - 1);
      if (dt < startdt) dt.setFullYear(dt.getFullYear() + 1);
    }
    // Год задан, менять не можем
    if (yy > 0) {
      dt.setFullYear(yy);
    }

    return dt.getTime() > Date.now() ? dt : 0;
    // return dt;
  } catch (e) {
    console.log('ERR: Schedutils.getDateForTemplate for ' + JSON.stringify(datestr) + ' : ' + e.message);
  }
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
