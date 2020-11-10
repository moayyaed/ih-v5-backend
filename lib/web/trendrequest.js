/**
 *  trendrequest.js
 */

const util = require('util');

const dbconnector = require('../dbconnector');

// Обработчик запросов /trend
// /trend?id=yy&uuid=uu&start..&end=..&dn=...

module.exports = function(holder) {
  return async (req, res, next) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      if (!query.uuid) throw { message: 'Expected uuid in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      res.setHeader('Content-Type', 'application/json');
      const dataObj = await dbconnector.read(formDbQuery(query));

      // Преобразовать данные в массив

      // const result = Object.assign({ response: 1 }, formDataArray(dataObj));
      const result = { response: 1, data: formDataArray(dataObj) };
      res.send(JSON.stringify(result));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};

function formDbQuery(query) {
  return { select: 'value', from: query.start, to: query.end || Date.now() };
}

function formDataArray(dataObj, query) {
  const current = Date.now();
  let ts = query.start;
  const end = query.end || current;

  const arr = [];
  while (ts < end ) {
    let val =  Math.round(Math.random() * 20);
    arr.push([ts, val]);
    ts += 30000;
  }
  return arr;
}
