/**
 * Формирует таблицы для форм
 */
const util = require('util');

const hut = require('../utils/hut');
const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const datautil = require('../dbs/datautil');

const virtTables = {
  devicecommonTable: devicecommon,

  unitchannelsTable:unitchannels
};

exports.get = async function(dataFromTable, table, nodeid, item) {
  return virtTables[table]
    ? virtTables[table](dataFromTable, table, nodeid, item)
    : formTableData(dataFromTable, table, nodeid, item);
};

async function formTableData(dataFromTable, table, nodeid, pitem) {
  const columns = pitem.columns;
  const desc = descriptor.getTableDesc(table);

  let rec;
  // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
  const recs = dataFromTable[table];
  if (Array.isArray(recs) && recs.length > 0) {
    rec = recs[0];
  }

  let genfield = pitem.genfield || desc.genfield;
  console.log('!!genfield '+genfield);
  console.log('rec '+util.inspect(rec));

  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];

  // Преобразовать в массив, ключ всегда преобразуется в id?

  const arr = Array.isArray(pObj) ? pObj : hut.objectToArray(pObj, 'id');

  // Обработка полей типа droplist, подготовить списки
  const dropLists = await formDroplists(columns);

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr.map((item, idx) => {
    const row = { id: item.id || String(idx+1) };
    columns.forEach(col => {
      if (item[col.prop] != undefined) {
        row[col.prop] = col.type == 'droplist' ? formDroplistValue(col.prop, item[col.prop]) : item[col.prop];
      } else {
        row[col.prop] = datautil.getEmptyValue(col.type);
      }
    });
    return row;
  });

  console.log('tdata= ' + util.inspect(tdata));
  return tdata;

  function formDroplistValue(prop, val) {
    return dropLists[prop] ? dropLists[prop].find(el => el.id == val) || '' : '';
  }
}

// подготовить списки для полей типа droplist,
async function formDroplists(columns) {
  const larr = columns.filter(el => el.type == 'droplist');
  if (!larr.length) return '';

  const droplists = {};
  for (let item of larr) {
    if (item.data && Array.isArray(item.data)) {
      droplists[item.prop] = item.data;
    } else {
      // item.data - это имя списка
      const listdata = await datautil.getList(item.data); // => {data:arr}
      droplists[item.prop] = listdata.data;
    }
  }
  return droplists;
}

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

async function devicecommon(dataFromTable, table, nodeid, pitem) {
  const columns = pitem.columns;
  const arr = await formTableData(dataFromTable, table, nodeid, columns);

  // Добавить данные каналов
  const hrec = await dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  
  arr.forEach(item => {
    item.prop = item.id;
    if (hObj[item.prop]) {
      item.unit = hObj[item.prop].unit;
      item.chan = hObj[item.prop].chan;
    }
  });

  // Добавить текущее состояние
  const crec = await dbstore.get('devcurrent', { _id: nodeid });

  if (crec && crec[0] && crec[0].raw) {
    const cObj = hut.arrayToObject(crec[0].raw, 'prop');
    arr.forEach(item => {
      if (cObj[item.prop]) {
        item.val = cObj[item.prop].val;
        if (cObj[item.prop].ts > 0) {
          try {
            item.ts = hut.getDateTimeFor(new Date(cObj[item.prop].ts), 'reportdt');
          } catch (e) {
            console.log('Error data format. ' + cObj[item.prop].ts + ' ' + util.inspect(e));
          }
        }
      }
    });
  }

  return arr;
}


async function unitchannels(dataFromTable, table, nodeid, pitem) {
  console.log('unitchannels start')
  return dbstore.get('devhard', { unit: nodeid });
}