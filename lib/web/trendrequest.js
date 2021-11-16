/**
 *  trendrequest.js
 *
 *  Middleware function for endpoint  /trend
 *
 *  /trend?id=yy&start..&end=..&did_prop=
 */

const util = require('util');

const hut = require('../utils/hut');
const rollup = require('../utils/rollup');
const liststore = require('../dbs/liststore');

const dbconnector = require('../dbconnector');

/**
 * trendType = 'analytics' || 'timeline' || 'trend'(default)
 */
module.exports = function(holder, trendType) {
  return async (req, res) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      const from = Number(query.start);
      const to = Number(query.end) || Date.now();
      // Может быть dn_prop или did_prop
      // did_prop заменить на dn_prop
      if (query.did_prop) {
        query.dn_prop = getDnProp(query.did_prop);
      }

      const parts = getParts(query.dn_prop);

      // const data = await getData(query);
      const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop };

      if (trendType == 'timeline') {
        readObj.table = 'timeline';
        // Для каждого - получить последний c учетом времени старта
      } else {
        readObj.target = 'trend';
      }
      // Добавить параметры из описания графика
      if (query.id && query.id.startsWith('c')) {
        const doc = await holder.dm.findRecordById('chart', query.id);
        if (!doc) throw { message: 'Not found chart: ' + util.inspect(query) };
        readObj.data_type = doc.data_type; // trend, analytics
        if (doc.data_type == 'calculation') {
          readObj.calc_type = doc.calc_type;
          readObj.discrete = doc.discrete;
        }
      }

      // let data = query.start > Date.now() ? [] : await dbconnector.read(readObj);
      let data = [];
      if (query.start < Date.now()) {
        data = await dbconnector.read(readObj);

        if (trendType == 'timeline') {
          data = processTimeline(data, parts, from, to);
        } else if (data.length && data[0].length > 1 && hut.isTheSameDate(Number(query.start), Date.now())) {
          const lastRec = [Date.now()];
          // Длина всех элементов одинакова
          for (let i = 1; i < data[0].length; i++) {
            let lastVal = null;
            let j = data.length - 1;
            while (j >= 0 && lastVal == null) {
              if (data[j][i] != null) lastVal = data[j][i];
              j -= 1;
            }
            lastRec.push(lastVal);
          }
          data.push(lastRec);
          console.log('INFO: add lastRec= ' + util.inspect(lastRec));
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ response: 1, data }));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };

  function processTimeline(data, parts, from, to) {
    const ts = Date.now();
    let i = 1;
    parts.forEach(dn_prop => {
      if (holder.timelineSet[dn_prop] && holder.timelineSet[dn_prop].start && holder.timelineSet[dn_prop].start < to) {
        // Есть незавершенная операция
        const start = holder.timelineSet[dn_prop].start;
        const state = holder.timelineSet[dn_prop].state;
        const [dn, prop] = dn_prop.split('.');
        data.push({ dn, prop, start, end: ts, state, id: ts + i });
        i++;
      }
    });

    data.forEach(item => {
      // start д б в диапазоне ?
      if (item.start < from) {
        item.start = from;
      }
      if (item.end > to) {
        item.end = to;
      }
      item[item.prop] = item.state;
    });
    // console.log('trendrequest AFTER CONNECTOR data=' + util.inspect(data));

    if (hut.isTheSameDate(from, ts)) {
      data.push({ id: 'current', start: ts, end: ts + 1, type: 'background', className: 'current' });
    }

    return data;
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

  function getParts(dn_prop) {
    const arr = dn_prop.split(',');
    return !arr || !arr.length ? [] : arr;
  }

  function getAggregateAttr(query) {
    if (!query.period || !query.function) return;
    if (query.period == '-' || query.period == 'null' || query.function == '-' || query.function == 'null') return;
    if (
      !liststore.getTitleFromList('chartAggPeriodList', query.period) ||
      !liststore.getTitleFromList('chartAggFunctionList', query.function)
    )
      return;
    return { period: query.period, fun: query.function };
  }
};

/*
async function getData(query) {
  if (query.start > Date.now()) return [];

  const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop, target: 'trend' };
  return dbconnector.read(readObj);
}
*/
