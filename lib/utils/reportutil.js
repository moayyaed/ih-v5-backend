/**
 * reportutil.js
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const rollup = require('./rollup');
const appconfig = require('../appconfig');

exports.getReportReadObj = getReportReadObj;
exports.processReportResult = processReportResult;
exports.processReportContent = processReportContent;

/**
 * Формирование объекта для передачи dbreporter-у
 *
 * @param {Object} qobj  {id:<id отчета>, start, end}
 * @param {Object} doc  - документ - описание отчета
 *
 * @return {Object} - {}
 * @throw - в случае ошибки
 *
 */
async function getReportReadObj(qobj, holder) {
  // Параметры отчета
  let { id, start, end } = qobj;
  start = Number(start);
  // ВАЖНО!! Если приходит только конечная дата, qobj.end передается как ts в 00:00:00 - а нам нужно 23:59:59!!
  //       Здесь пересчитывается getReportEndTs
  end = hut.isTimeZero(end) ? hut.getLastTimeOfDay(end) : Number(end);

  // Получить описание отчета и обработать
  const rec = await holder.dm.findRecordById('reports', id);
  if (!rec) throw { message: 'Report not found: ' + util.inspect(qobj) };
  if (!rec.props) throw { message: 'No columns for report ' + id };

                     
  const columns = hut.transfromFieldObjToArray(rec.props);
  if (!columns || !columns.length) throw { message: 'No columns for report ' + id };

  // Одно устройство может быть неск раз!!
  const dn_propSet = new Set(); // Выбрать из столбцов названия свойств устройств 
  columns.forEach(item => {
    if (item.col_type == 'value' && item.dn_prop) dn_propSet.add(item.dn_prop);
  });
  const dn_prop = Array.from(dn_propSet).join(',');

  const content = ''; // processReportContent(rec, qobj);

  if (rec.data_type == 'plugin') {
    return {
      id,
      plugin: rec.plugin,
      unit: rec.plugin,
      pluginreport: rec.pluginreport,
      filter: { start, end },
      content,
      columns
    };
  }

  let readobj = {
    id,
    dbtable: 'records',
   
    filter: { start, end,  dn_prop },
    content:{discrete:'hour', blocks:[{block_type:'table'}]},
    columns
  };

  // if (readobj.dbtable == 'consumption') {
  /*
 if (listRec.data_type == 'diffconsumption') {
   readobj.diffstart = readobj.filter.start;
   readobj.filter.start = '';
   readobj.diffconsumption = true;
 }
 */

  return readobj;
}

function getDnProp(did_prop) {
  const didArr = did_prop.split(',');
  if (!didArr || !didArr.length) return '';
  const arr = didArr
    .filter(el => el && el.indexOf('.') > 0)
    .map(el => {
      const [did, prop] = el.split('.');
      return holder.devSet[did] ? holder.devSet[did].dn + '.' + prop : did_prop;
    });
  return arr.length ? arr.join(',') : '';
}

function getPeriodStr(fromTs, toTs) {
  let from = new Date(Number(fromTs));
  let to = new Date(Number(toTs));

  if (hut.wholeYear(from, to)) return getYear(fromTs);
  if (hut.wholeMonth(from, to)) return getMonthAndYear(fromTs);

  return hut.getDateTimeFor(from, 'reportd') + ' - ' + hut.getDateTimeFor(to, 'reportd');
}

function getMonthAndYear(ts) {
  let dt = new Date(Number(ts));
  let mon = appconfig.getMonth(dt.getMonth() + 1);
  return mon ? mon.name + ' ' + dt.getFullYear() : '';
}

function getYear(ts) {
  let dt = new Date(Number(ts));
  return dt ? +dt.getFullYear() : '';
}

/**
 * Выполнить в блоки отчета подстановку ${} для полей text
 * @param {Object} rec - блоки отчета
 * @param {Object} qobj - параметры отчета
 */
function processReportContent(rec, qobj) {
  if (!rec || typeof rec != 'object') return '';
  let result = hut.clone(rec);

  if (result.blocks && util.isArray(result.blocks)) {
    result.blocks.forEach(item => {
      if (item.block_type == 'text' && item.text) {
        item.text = item.text.replace(/\${(\w*)}/g, (match, p1) => {
          switch (p1) {
            case 'period':
              return dateutils.getPeriodStr(qobj.start, qobj.end);
            default:
              return p1;
          }
        });
      }
    });
  }
  return result;
}

/**
 *
 * @param {*} readobj
 * @param {*} arr
 */
function processReportResult(readobj, arr, houser) {
  // Сформировать таблицу как массив массивов в соответствии с columns
  if (!arr || !util.isArray(arr) || !arr.length) return [];
  if (!readobj || !readobj.columns || !util.isArray(readobj.columns) || !readobj.columns.length) return [];

  let discrete = readobj.content.discrete;

  // Добавить последние значения из устройств, если таблица - consumption и запрос включает сегодня
  if (readobj.dbtable == 'consumption' && readobj.filter && readobj.filter.dn && readobj.filter.end >= Date.now()) {
    arr.push(...houser.getCurrentValuesForDb(readobj.filter.dn.split(',')));
  }

  let rollarr = readobj.diffconsumption ? calcDiff(readobj, arr, houser) : rollup(arr, discrete, readobj.columns);
  return finProcess(rollarr, readobj.columns, discrete);
}
// Применить форматирование, вычислить итоги
function finProcess(rarr, cols, discrete) {
  let total;
  let needtotal = cols.some(item => item.total);
  if (needtotal) total = cols.map(() => 0);

  for (let i = 0; i < rarr.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      // if (readobj.columns[j].col_type == 'data' && readobj.columns[j].date_format) {
      switch (cols[j].col_type) {
        case 'date':
          try {
            rarr[i][j] = getDateStr(rarr[i][j], discrete);
          } catch (e) {
            console.log('ERR: Report finProcess: Invalid date:' + rarr[i][j]);
          }
          break;

        case 'value':
          if (total && cols[j].total && rarr[i][j] != null) {
            total[j] += rarr[i][j];
          }
          rarr[i][j] = getFormattedValue(rarr[i][j], cols[j].decdig);
          break;

        case 'rowtotal':
          rarr[i][j] = getFormattedValue(rowtotal(i), cols[j].decdig);

          if (total && cols[j].total) {
            total[j] += Number(rarr[i][j]);
          }
          break;
        default:
      }
    }
  }

  if (total) {
    let totalrow = ['Итого'];
    for (let j = 1; j < cols.length; j++) {
      // totalrow.push(cols[j].total ? String(total[j]) : '');
      totalrow.push(cols[j].total ? getFormattedValue(total[j], cols[j].decdig) : '');
    }
    rarr.push(totalrow);
  }
  return rarr;

  function rowtotal(rowidx) {
    let res = 0;
    cols.forEach((item, colidx) => {
      if (item.col_type == 'value' && !isNaN(rarr[rowidx][colidx])) res += Number(rarr[rowidx][colidx]);
    });
    return res;
  }
}

function getFormattedValue(val, decdig = 0) {
  return isNaN(val) ? '' : Number(val).toFixed(decdig);
}

function getDateStr(ts, discrete) {
  let format;
  if (discrete == 'year') return dateutils.getYear(ts);
  if (discrete == 'month') return dateutils.getMonthAndYear(ts);
  switch (discrete) {
    case 'day':
      format = 'reportd';
      break;

    case 'hour':
    case 'min':
      format = 'reportdt';
      break;

    default:
      format = ''; // YY-MM-DD HH:MM:SS
  }
  return hut.getDateTimeFor(new Date(ts), format);
}

function calcDiff(readobj, arr) {
  let diffstart = readobj.diffstart;
  let dnarr = readobj.filter.dn.split(',');

  let val0 = {};
  dnarr.forEach(dn => {
    val0[dn] = 0;
  });

  let i = 0;
  while (i < arr.length && arr[i].ts < diffstart) {
    val0[arr[i].dn] = arr[i].val;
    i += 1;
  }

  // Удалить значения до diffstart
  arr.splice(0, i);

  // свернуть по max - показания на конец - часа, дня, месяца
  // Используем cols
  let cols = readobj.columns.map(item => {
    if (item.col_type == 'value') item.calc_type = 'max';
    return item;
  });

  let discrete = 'day';
  let rarr = rollup(arr, discrete, cols);

  // Посчитать diff
  let diff = rarr.map(larr =>
    larr.map((item, idx) => {
      if (cols[idx].col_type != 'value') {
        return item;
      }

      let diffval = 0;
      let dn = cols[idx].dn;
      if (item >= val0[dn]) {
        // diffval = Math.round(item - val0[dn]);
        diffval = rounding(item - val0[dn], cols[idx].decdig);

        val0[dn] = item;
      }
      return diffval;
    })
  );

  return diff;
}

function rounding(value, decdig) {
  if (isNaN(decdig) || decdig <= 0) return Math.round(value);

  let factor = 1;
  for (let i = 0; i < decdig; i++) factor *= 10;
  return Math.round(value * factor) / factor;
}
