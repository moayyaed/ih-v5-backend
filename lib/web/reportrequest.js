/**
 *  reportrequest.js
 *
 *  Middleware function for endpoint  /report
 *
 *  /report?id=yy&start..&end=..
 */

const util = require('util');

// const hut = require('../utils/hut');
const reportutil = require('../utils/reportutil');
const dbreporter = require('../dbreporter');

/**
 *
 */
module.exports = function(holder) {
  return async (req, res) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      const readObj = await reportutil.getReportReadObj(query, holder);

      let data = query.start > Date.now() ? [] : await dbreporter.getReport(readObj);

      // В зависимости от того, что запросили?
      // По умолчанию {data:[], columns:[]}
      const columns = readObj.columns.map(item => ({ title: item.name, width: item.width, align: item.align }));
      res.setHeader('Content-Type', 'application/json');
      // res.send(JSON.stringify({ response: 1, data }));
      res.send(JSON.stringify({ response: 1, data, columns }));
    } catch (e) {
      console.log('ERROR: reportrequest: ' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};
