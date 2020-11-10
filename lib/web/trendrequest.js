/**
 *  trendrequest.js
 */

const util = require('util');

const hut = require('../utils/hut');
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

      // Получить данные графика?
      let dataArr;
      if (query.dn_prop && query.dn_prop.startsWith('DN002')) {
        const from = hut.dateToISOString(new Date(Number(query.start)));
        const to = hut.dateToISOString(new Date(Number(query.end)));

        const dbdata = await dbconnector.read({ select: 'DN002', from, to });
        dataArr = formDataArray(dbdata);
      }
      if (!dataArr) dataArr = stubDataArray(query);

      // const dataObj = await dbconnector.read(formDbQuery(query));

      // Преобразовать данные в массив

      // const result = Object.assign({ response: 1 }, formDataArray(dataObj));
      const result = { response: 1, data: dataArr };
      res.setHeader('Content-Type', 'application/json');
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

function formDataArray(dbdata) {
  if (!dbdata || !Array.isArray(dbdata)) return [];
  const res = [];
  for (let i = 0; i < dbdata.length; i++) {
    // dn + ',' + prop + ',' + ts + ',' + val
    const lineArr = dbdata[i].split(',');
    res.push([lineArr[2], lineArr[3]]);
  }
  return res;
}

function stubDataArray(query) {
  // Заглушка. Данные генерируются с интервалом 3 минуты
  let ts = Number(query.start);
  const end = Number(query.end);

  const arr = [];
  console.log('ts=' + ts + 'end=' + end);
  while (ts < end) {
    let val = Math.round(Math.random() * 20);
    arr.push([ts, val]);
    ts += 180000;
  }
  return arr;
}
