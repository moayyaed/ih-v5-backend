/**
 * Утилиты общего назначения
 *
 */

const util = require('util');

exports.pad = pad;
exports.getDateTimeForTs = getDateTimeForTs;
exports.objMustHaveProps = objMustHaveProps;
exports.getDtxFromTs = getDtxFromTs;
exports.getTsFromDtx = getTsFromDtx;

exports.formWidgetReloadCommands = formWidgetReloadCommands;

function getDateTimeForTs(ts, format) {
  if (!ts || typeof ts != 'number') return '';

  const dt = new Date(ts);
  switch (format) {
    case 'reportdt': // DD.MM.YYYY HH.MM
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes())
      );

    case 'reportdts': // DD.MM.YYYY HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' + 
        pad(dt.getSeconds()));

    case 'reportdate': // DD.MM.YYYY
      return pad(dt.getDate()) + '.' + pad(dt.getMonth() + 1) + '.' + dt.getFullYear();

    case 'reporttime': // HH.MM.SS
      return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());

    default:
      // DD.MM.YYYY HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds())
      );
  }
}

function pad(val, width, ch) {
  let numAsString = val + '';
  ch = ch || '0';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = ch + numAsString;
  }
  return numAsString;
}

/**
 * Сформировать для элементов массива команды "widget_reload"
 */
function formWidgetReloadCommands(larr, clid, start, end) {
  return !larr || !Array.isArray(larr)
    ? []
    : larr
        .filter(item => item.type == 'WIDGET_CHARTS_CANVAS' || item.type == 'WIDGET_REPORT')
        .map(item => ({
          id: 'widget_reload_' + item.id,
          type: 'action',
          response: 1,
          clid,
          route: {
            command: 'widget_reload',
            widget: item.id,
            params: {
              content: {
                range: [start, end],
                timerange: [start, end],
                triger: start,
                forceRealtime: false
              }
            }
          }
        }));
}

/**
 * Функция проверяет, что объект имеет заданные свойства.
 * Если нет - возбуждает исключение
 * @param {Object} obj - объект
 * @param {String} proplist - список свойств через запятую
 *
 * Если obj не объект  - возбуждает исключение
 * Если proplist не строка - возбуждает исключение
 * Если proplist пусто (строка не задана) ничего не делает
 *
 */
function objMustHaveProps(obj, proplist) {
  if (!proplist) return;
  if (typeof proplist !== 'string') throw { message: `Expected string type for proplist: ${util.inspect(proplist)}` };

  if (typeof obj !== 'object') throw { message: `Expected object with props: ${proplist}` };

  proplist.split(',').forEach(prop => {
    if (obj[prop] == undefined) throw { message: `Missing ${prop}` };
  });
}


// Преобразовать в зависимости от дискреты
function getDtxFromTs(ts, discrete) {
  let dt = new Date(ts);
  let dtx = String(dt.getFullYear() - 2000);
  dtx += pad(dt.getMonth());
  if (discrete == 'month') return dtx;

  dtx += pad(dt.getDate());
  if (discrete == 'day') return dtx;

  dtx += pad(dt.getHours());
  if (discrete == 'hour') return dtx;

  dtx += pad(dt.getMinutes());
  return dtx;
}

function getTsFromDtx(dtx, discrete) {
  let yy = Number(dtx.substr(0, 2)) + 2000;
  let mm = Number(dtx.substr(2, 2));
  let dd = 0;
  let hh = 0;
  let minutes = 0;

  if (discrete == 'month') {
    dd = 1;
    hh = 0;
  } else {
    dd = Number(dtx.substr(4, 2));
    if (discrete == 'day') {
      hh = 0;
    } else {
      hh = Number(dtx.substr(6, 2));
      if (discrete == 'hour') {
        minutes = 0;
      } else {
        minutes = Number(dtx.substr(8, 2));
      }
    }
  }

  return new Date(yy, mm, dd, hh, minutes).getTime();
}
