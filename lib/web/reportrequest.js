/**
 *  reportrequest.js
 *
 *  Middleware function for endpoint  /report
 *
 *  /report?id=yy&start..&end=..
 */

const util = require('util');

const hut = require('../utils/hut');
const rollup = require('../utils/rollup');
const liststore = require('../dbs/liststore');

const dbreporter = require('../dbreporter');

/**
 * reportType = 'table' || 'csv' || 'pdf'
 */
module.exports = function(holder, reportType) {
  return async (req, res) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop };

     
        readObj.target = 'reportType';
      
      // Добавить параметры из описания 
      if (query.id && query.id.startsWith('c')) {
        const doc = await holder.dm.findRecordById('report', query.id);
        if (!doc) throw { message: 'Not found report: ' + util.inspect(query) };
        readObj.data_type = doc.data_type; // trend, analytics
        if (doc.data_type == 'calculation') {
          readObj.calc_type = doc.calc_type;
          readObj.discrete = doc.discrete;
        }
      }

      let data = query.start > Date.now() ? [] : await dbreporter.read(readObj);

      

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ response: 1, data }));
    } catch (e) {
      console.log('ERROR: reportrequest: ' + util.inspect(e));
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
