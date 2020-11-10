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
      const result = {response: 1 , data: formDataArray(dataObj)};
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

function formDataArray(dataObj) {
  // Прииходит массив строк
  return [
    [1604869227673, 16.5],
    [1604869324970, 16],
    [1604869417716, 16],
    [1604869607841, 15.5],
    [1604869745368, 17],
    [1604869797888, 16.5],
    [Date.now(), 16]
  ];
}

