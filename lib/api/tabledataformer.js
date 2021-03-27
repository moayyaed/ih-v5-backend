/**
 * Формирует таблицы для форм
 */

// const util = require('util');

const hut = require('../utils/hut');
const descriptor = require('../descriptor');

const datautil = require('./datautil');


async function formTableData(dataFromTable, table, nodeid, pitem, holder) {
  const dm = holder.dm;
  const pObj = getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj || hut.isObjIdle(pObj)) return [];

  // Преобразовать в массив, ключ всегда преобразуется в id + newid
  const arr = transfromGenfieldObjToArray(pObj);

  // Сформировать данные по столбцам
  return formColumnVals(pitem.columns, arr, holder);
}

function getGenfieldObjFromDataRecord(dataFromTable, table, pitem) {
  let rec = dataFromTable[table];
  // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
  /*
  const recs = dataFromTable[table];
  if (Array.isArray(recs) && recs.length > 0) {
    rec = recs[0];
  }
  */

  const desc = descriptor.getTableDesc(table);
  const genfield = pitem.genfield || desc.genfield;
  const genfilter = pitem.genfilter || desc.genfilter;
  const result = rec && rec[genfield] ? rec[genfield] : '';

  return result && genfilter ? getFilteredObject(result, genfilter) : result;
}

function getFilteredObject(obj, filter) {
  const result = {};
  Object.keys(obj).forEach(prop => {
    if (obj[prop] && hut.isInFilter(obj[prop], filter)) {
      result[prop] = obj[prop];
    }
  });
  return result;
}

function transfromGenfieldObjToArray(pObj) {
  return Array.isArray(pObj)
    ? pObj
    : Object.keys(pObj)
        .filter(prop => pObj[prop])
        .map(prop => ({ _id: prop, id: prop, newid: prop, ...pObj[prop] }));
}

async function formColumnVals(columns, dataArr, holder ) {
  const dm = holder.dm;
  // Обработка полей типа droplist, подготовить списки
  const dropLists = await formDroplists(columns, holder);

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = dataArr.map((item, idx) => {
    item.prop = item.prop || item.id;
    const row = { id: item.id || String(idx + 1) };

    columns.forEach(col => {
      if (col.prop.startsWith('__')) {
        // Служебные поля для чтения
        row[col.prop] = derivativeValue(col, item);
      } else if (col.type == 'link') {
        row[col.prop] = dm.datagetter.formLinkObj(col, item, item[col.prop]);
      } else if (col.type == 'smartbutton2') {
        row[col.prop] = dm.datagetter.formSmartbutton2Obj(col, item, item[col.prop]);
      } else if (item[col.prop] != undefined) {
        row[col.prop] =
          col.type == 'droplist' ? formDroplistValue(dropLists, col.prop, item[col.prop]) : item[col.prop];
      } else {
        row[col.prop] = datautil.getEmptyValue(col.type);
      }
    });
    return row;
  });
  return tdata;
}

function derivativeValue(col, item) {
  switch (col.prop) {
    case '__idprefix':
      return item._id && item._id.indexOf('@') ? item._id.split('@') : '';
    default:
      return '';
  }
}

// подготовить списки для полей типа droplist,
async function formDroplists(columns, holder) {
  const larr = columns.filter(el => el.type == 'droplist');
  if (!larr.length) return '';

  const droplists = {};
  for (let item of larr) {
    if (item.data && Array.isArray(item.data)) {
      droplists[item.prop] = item.data;
    } else {
      // item.data - это имя списка
      const listdata = holder.dm.datagetter.getDroplist({id:item.data}, holder); // => {data:arr}
      droplists[item.prop] = listdata.data;
    }
  }
  return droplists;
}

function formDroplistValue(dropLists, prop, val) {
  return dropLists[prop] ? dropLists[prop].find(el => el.id == val) || '' : '';
}

async function formRows(table, arr, columns, holder) {
  const dm = holder.dm;
  const dropLists = await formDroplists(columns, holder);

  return arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id ? item._id : item.id};
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = dm.datagetter.formLinkObj(table, col, item, item[col.prop]);
        } else if (col.type == 'droplist') {
          row[col.prop] = formDroplistValue(dropLists, col.prop, item[col.prop]);
        } else if (col.prop == 'tags') {
          row[col.prop] = item[col.prop] ? item[col.prop].join(', ') : '';
        } else if (item[col.prop] != undefined) {
          row[col.prop] = item[col.prop];
        } else {
          row[col.prop] = datautil.getEmptyValue(col.type);
        }
      });
      return row;
    });
}

module.exports = {
  formTableData,
  formRows,
  formColumnVals,
  formDroplistValue,
  transfromGenfieldObjToArray,
  getGenfieldObjFromDataRecord
};
