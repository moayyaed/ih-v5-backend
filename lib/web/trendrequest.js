/**
 *  trendrequest.js
 */

const util = require('util');

const hut = require('../utils/hut');
const dbdatautil = require('../utils/dbdatautil');

const dbconnector = require('../dbconnector');
const dm = require('../datamanager');

// Обработчик запросов /trend
// /trend?id=yy&uuid=uu&start..&end=..&dn=...

module.exports = function(holder) {
  return async (req, res, next) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      // if (!query.uuid) throw { message: 'Expected uuid in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      // dm.insertToLog('pluginlog', { unit: 'db', txt:'INFO: '+query.uuid+ ' Get trend ' });

      const data = await getData(query);

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ response: 1, data }));
      // dm.insertToLog('pluginlog', { unit: 'db', txt:'INFO: '+query.uuid+ ' Response ' });
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};

async function getData(query) {
  if (query.start > Date.now()) return [];

  // Получить данные графика?
  let dataArr;
  const dnArr = query.dn_prop.split(',');
  const from = hut.dateToISOString(new Date(Number(query.start)));
  const to = hut.dateToISOString(new Date(Number(query.end)));

  if (dnArr && dnArr.length) {
    if (dnArr[0].startsWith('DN002')) {
    
      // Первое значение
      const dbdata = await dbconnector.read({ select: 'DN002', where: { prop: 'value' }, from, to });
      dataArr = dbdatautil.formDataArray(dbdata, dnArr.length);

      // Остальные значения - нужно будет вставить в основной массив - сделать на промисах?
      if (dnArr.length > 1) {
        for (let i = 1; i < dnArr.length; i++) {
          const data = await dbconnector.read(getReadObj(dnArr[i]));
          dbdatautil.insertToDataArray(dataArr, data, i + 1);
        }

        /* 
        const promises = dnArr.map(dnprop => dbconnector.read(getReadObj(dnprop)));
        const results = await Promise.all(promises);
        results.forEach((result, index) => {
          dbdatautil.insertToDataArray(dataArr, result, 2);
        });
        */
      }

      // const data2 = await dbconnector.read({ select: 'vvv150', where: { prop: 'value' }, from, to });
      // dbdatautil.insertToDataArray(dataArr, data2, 2);
    }
  }

  if (!dataArr) dataArr = stubDataArray(query);
  return dataArr;

  function getReadObj(dnprop) {
    const splited = dnprop.split('.');
    return { select: splited[0], where: { prop: splited[1] }, from, to };
  }
}

function formDbQuery(query) {
  return { select: 'value', from: query.start, to: query.end || Date.now() };
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
