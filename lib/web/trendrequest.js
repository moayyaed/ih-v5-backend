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

      // Может быть dn_prop или did_prop
      // did_prop заменить на dn_prop
      if (query.did_prop) {
        query.dn_prop = getDnProp(query.did_prop);
      }
      
      // const data = await getData(query);
      const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop};

      if (trendType == 'timeline') {
        readObj.table = 'timeline';
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

      let data = query.start > Date.now() ? [] : await dbconnector.read(readObj);
      /*
      if (analytics) {
        // Пока суммирую по временным интервалам
        let cols = [{ col_type: 'value', dn: query.dn_prop, calc_type: 'sum' }];

        let discrete = 'hour';
        data = rollup(data, discrete, cols);
      }
      */

      // Если данные за сегодня - продлить значения до now???
      // const y = hut.isTheSameDate(Number(query.start), Date.now());
    
      if (data.length && data[0].length > 1 && hut.isTheSameDate(Number(query.start), Date.now())) {
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
        console.log('INFO: add lastRec= ' +util.inspect(lastRec));
      }

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ response: 1, data }));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };

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
};

/*
async function getData(query) {
  if (query.start > Date.now()) return [];

  const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop, target: 'trend' };
  return dbconnector.read(readObj);
}
*/
