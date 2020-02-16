/**
 * systime.js
 */

const suncalc = require('suncalc');

const jdb = require('../utils/jdb');

exports.getSysTime = getSysTime;

function getSysTime(name, date) {
  switch (name) {
    case 'sunrise':
    case 'sunset':
      return getSunTime(name, date);
    case 'hourly':
      return getNextHourly();
    default:
      return new Date();
  }
}

function getNextHourly() {
  let dt = new Date();
  let hh = dt.getHours();
  if (dt.getMinutes() == 59 && dt.getSeconds() == 59) hh += 1;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), hh, 59, 59, 0);
}

function getSunTime(name, date) {
  let getDate = calcGetDate(date);

  let location = jdb.getFirstRecord({ name: 'location' });

  let suntimes = suncalc.getTimes(getDate, location.lat, location.lng);

  return suntimes[name] ? suntimes[name].getTime() : 0;
}

function calcGetDate(date) {
  let result;
  let today = new Date();
  if (!date) date = today;

  if (date instanceof Date) {
    result = date;
  } else if (typeof date == 'string') {
    switch (date) {
      case 'today':
        result = today;
        break;
      case 'tomorrow':
        result = new Date().setDate(today.getDate() + 1);
        break;
      default:
    }
  } else if (typeof date == 'number') {
    result = new Date(date);
  }
  return result;
}
