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
 
  if (!dbdata || !Array.isArray(dbdata)) return [];
  console.log('WARN: formDataArray dbdata.length='+dbdata.length)
  const res = [];
  for (let i = 0; i < dbdata.length; i++) {
    // dn + ',' + prop + ',' + ts + ',' + val
    if (dbdata[i]) {
      const lineArr = dbdata[i].split(',');
      const one = new Array(len + 1).fill(null);
      one[0] = Number(lineArr[2]); // ts
      one[1] = Number(lineArr[3]); // первое значение
      res.push(one);
    }
  }
  console.log('WARN: formDataArray res.length='+res.length)
  return res;
}

function insertToDataArray(dataArr, data2, len, npp) {
  // Все элементы массива data2 вставить в dataArr
  //  Оба упорядочены по ts
  const order = 2;
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
      console.log('index='+index)
      if (dataArr[index][0] > newTs) {
        console.log(dataArr[index][0]+'>'+newTs)
        max = index;
        console.log('max='+max )
      } else {
        console.log(dataArr[index][0]+'<'+newTs)
        min = index + 1;
        console.log('min='+min)
      }
      index = Math.floor((min + max) / 2);
    }
    //
    console.log('INDEX='+index )
    if (index >=dataArr.length || dataArr[index][0] != newTs) {
      const item = new Array(len + 1).fill(null);
      item[0] = newTs;
      dataArr.splice(index, 0, item);
    }
    return index;
  }
}
