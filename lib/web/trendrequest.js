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
      if (!query.uuid) throw { message: 'Expected uuid in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      dm.insertToLog('pluginlog', { unit: 'db', txt:'INFO: '+query.uuid+ ' Get trend ' });

      // Получить данные графика?
      let dataArr;
      const dnArr = query.dn_prop.split(',');
      if (dnArr && dnArr.length) {
        if (dnArr[0].startsWith('DN002')) {
          // if (query.dn_prop && query.dn_prop.startsWith('DN002')) {
          const from = hut.dateToISOString(new Date(Number(query.start)));
          const to = hut.dateToISOString(new Date(Number(query.end)));

          // Первое значение
          const dbdata = await dbconnector.read({ select: 'DN002', where: { prop: 'value' }, from, to });
          dataArr = dbdatautil.formDataArray(dbdata, dnArr.length);

          // Остальные значения - нужно будет вставить в основной массив - сделать на промисах?
          if (dnArr.length > 1) {
            const splited = dnArr[1].split('.'); // vvv150.value
            const data2 = await dbconnector.read({ select: splited[0], where: { prop: splited[1] }, from, to });

            /*
         const promises = dnArr.map(dnprop => dbconnector.read(getReadObj(dnprop));
         const results = await Promise.all(promises);
         */
            dbdatautil.insertToDataArray(dataArr, data2, dnArr.length);
          }

          // const data2 = await dbconnector.read({ select: 'vvv150', where: { prop: 'value' }, from, to });
          // dbdatautil.insertToDataArray(dataArr, data2, 2);
        }
      }
      if (!dataArr) dataArr = stubDataArray(query);

      // Преобразовать данные в массив

      // const result = Object.assign({ response: 1 }, formDataArray(dataObj));
      const result = { response: 1, data: dataArr };
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result));
      dm.insertToLog('pluginlog', { unit: 'db', txt:'INFO: '+query.uuid+ ' Response ' });

    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};

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
