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
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };


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
  if (query.dn_prop.startsWith('undefined')) query.dn_prop = 'DN002.value';
  const readObj = {start:query.start, end:query.end || Date.now(), dn_prop:query.dn_prop, target:'trend' };
  return dbconnector.read(readObj);

  // console.log('TRENDREQ getData START');
  
  // Получить данные графика
 /*
  const dnArr = query.dn_prop.split(',');
  const from = hut.dateToISOString(new Date(Number(query.start)));
  const to = hut.dateToISOString(new Date(Number(query.end)));
  if (!dnArr || !dnArr.length) return [];
  console.log('TRENDREQ getData dnArr='+util.inspect(dnArr));

  if (dnArr.length == 1) {
    const dbdata = await dbconnector.read(getReadObj(dnArr[0]));
    console.log('TRENDREQ dbdata.length='+dbdata.length);

    return dbdatautil.formDataArray(dbdata, dnArr.length);
  }

  // Использовать join
  const dbdata = await dbconnector.read(getJoinObj());
  return dbdatautil.formDataArray(dbdata, dnArr.length);
  */
  /*
  if (dnArr && dnArr.length) {
    // Первое значение
    const dbdata = await dbconnector.read(getReadObj(dnArr[0]));
    dataArr = dbdatautil.formDataArray(dbdata, dnArr.length);

    // Остальные значения - нужно будет вставить в основной массив - сделать на промисах?
    if (dnArr.length > 1) {
        dnArr.shift();
        const promises = dnArr.map(dnprop => dbconnector.read(getReadObj(dnprop)));
        const results = await Promise.all(promises);
        results.forEach((result, index) => {
          dbdatautil.insertToDataArray(dataArr, result, dnArr.length+1, index+2);
        });
    }
  }

  // if (!dataArr) dataArr = stubDataArray(query);
  if (!dataArr) dataArr = [];
  return dataArr;
*/

  function getReadObj(dnprop) {
    const splited = dnprop.split('.');
    return { select: splited[0], where: { prop: splited[1] }, from, to };
  }

  function getJoinObj() {
    const metrics = [];
    for (let dnprop of dnArr) {
      const splited = dnprop.split('.');
      if (splited[0]) metrics.push(splited[0]);
    }
    return { join: metrics, where: { prop: 'value' }, from, to };
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
