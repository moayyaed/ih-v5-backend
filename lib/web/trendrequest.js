/**
 *  trendrequest.js
 */

const util = require('util');

const hut = require('../utils/hut');
const dbdatautil = require('../utils/dbdatautil');

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

        // Первое значение
        const dbdata = await dbconnector.read({ select: 'DN002', where: { prop: 'value' }, from, to });
        dataArr = formDataArray(dbdata, 2);

        // Остальные значения - нужно будет вставить в основной массив - сделать на промисах?
        const data2 = await dbconnector.read({ select: 'vvv150', where: { prop: 'value' }, from, to });
        insertToDataArray(dataArr, data2);
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

/**
 *
 * @param {*} dbdata
 * @param {Number} len - число значений (устройств)
 */

function formDataArray(dbdata, len) {
  if (!dbdata || !Array.isArray(dbdata)) return [];
  const res = [];
  for (let i = 0; i < dbdata.length; i++) {
    // dn + ',' + prop + ',' + ts + ',' + val
    if (dbdata[i]) {
      const lineArr = dbdata[i].split(',');
      const one = new Array(len + 1).fill(null);
      one[0] = Number(lineArr[2]); // ts
      one[1] = Number(lineArr[3]); // первое значение
    }
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

function insertToDataArray(dataArr, data2, len, npp) {
  // Все элементы массива data2 вставить в dataArr
  //  Оба упорядочены по ts
  const order = 2;
  if (!data2 || !Array.isArray(data2)) return [];

  let minIdx = 0;
  const maxIdx = dataArr.length;

  for (let i = 0; i < data2.length; i++) {
    if (data2[i]) {
      const lineArr = data2[i].split(',');
      const ts = Number(lineArr[2]);
      const val = Number(lineArr[3]);

      // Вставить в массив dataArr
      const idx = getIndex(minIdx, maxIdx, ts);
      dataArr[idx][order] = val;
    }
  }

  function getIndex(min, max, newTs) {
    let index = Math.floor((min + max) / 2);
    while (max > min) {
      if (dataArr[index][0] < newTs) {
        max = index;
      } else {
        min = index + 1;
      }
      index = Math.floor((min + max) / 2);
    }
    //
    if (dataArr[index][0] != newTs) {
      const item = new Array(len + 1).fill(null);
      item[0] = newTs;
      dataArr.splice(index, 0, item);
    }
    return index;
  }
}

/**
 function insertSorted(arr, item, comparator) {
    if (comparator == null) {
        // emulate the default Array.sort() comparator
        comparator = function(a, b) {
            if (typeof a !== 'string') a = String(a);
            if (typeof b !== 'string') b = String(b);
            return (a > b ? 1 : (a < b ? -1 : 0));
        };
    }

    // get the index we need to insert the item at
    var min = 0;
    var max = arr.length;
    var index = Math.floor((min + max) / 2);
    while (max > min) {
        if (comparator(item, arr[index]) < 0) {
            max = index;
        } else {
            min = index + 1;
        }
        index = Math.floor((min + max) / 2);
    }

    // insert the item
    arr.splice(index, 0, item);
};
 */
