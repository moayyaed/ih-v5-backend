/**
 *
 */

exports.formDataArray = formDataArray;
exports.insertToDataArray = insertToDataArray;

/**
 *
 * @param {*} dbdata
 * @param {Number} len - число значений (устройств)
 */

function formDataArray(dbdata, len) {
  console.log('formDataArray dbdata '+dbdata)
  if (!dbdata) return [];
  
  // TEMP1 prop=value,ts=1604328801885000000,999996 \n  select 

  // DN002|AI005 prop=value,ts=1605614617861000000,6,7  join
  // DN002|AI005 prop=value,ts=1605614617861000000,,77
  // DN002|AI005 prop=value,ts=1605614617861000000,7,
  const arr = dbdata.split('\n');

  const res = [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      const lineArr = arr[i].split(',');
      const one = new Array(len + 1).fill(null);
      one[0] = Number(lineArr[1].substr(3, 13)); // ts в формате Date.ts - 13 символов (без микросекунд)
      for (let j = 0; j < len; j++) {
        if (lineArr[2+j].length) one[1 + j] = Number(lineArr[2+j]); // 2 - первое значение
      }
      res.push(one);
    }
  }
  return res;
}


/**
 * Вставить массив data2 в массив dataArr
 * Оба упорядочены по ts
 *
 * @param {Array of arrays} dataArr [[ts, val1, val2, ... ], ...]
 * @param {Array of strings} data2 ["AI1,value,1678786876,-20", ..]
 * @param {Number} len - число значений (устройств). Используется при создании нового элемента dataArr
 * @param {Number} - order номер устройства - индекс в массиве [ts, val1, val2, ... ] - начиная с 2
 *
 */
function insertToDataArray(dataArr, data2, len, order) {
  if (!data2 || !Array.isArray(data2)) return [];

  let minIdx = 0;
  let maxIdx = dataArr.length;

  for (let i = 0; i < data2.length; i++) {
    if (data2[i]) {
      const lineArr = data2[i].split(',');
      const ts = Number(lineArr[2]);
      const val = Number(lineArr[3]);

      // Вставить в массив dataArr
      minIdx = 0;
      maxIdx = dataArr.length;
      const idx = getIndex(minIdx, maxIdx, ts);
      dataArr[idx][order] = val;
    }
  }

  function getIndex(min, max, newTs) {
    let index = Math.floor((min + max) / 2);

    while (max > min) {
      if (dataArr[index][0] > newTs) {
        console.log(dataArr[index][0] + '>' + newTs);
        max = index;
      } else {
        console.log(dataArr[index][0] + '<' + newTs);
        min = index + 1;
      }
      index = Math.floor((min + max) / 2);
    }

    if (index >= dataArr.length || dataArr[index][0] != newTs) {
      const item = new Array(len + 1).fill(null);
      item[0] = newTs;
      dataArr.splice(index, 0, item);
    }
    return index;
  }
}
