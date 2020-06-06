/**
 * Формирует таблицы для форм
 */

const util = require('util');

const hut = require('../utils/hut');
// const dm = require('../datamanager');
const descriptor = require('../descriptor');

const datautil = require('./datautil');

const datagetter = require('../appspec/datagetter');

async function formTableData(dataFromTable, table, nodeid, pitem) {
  const pObj = getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj || hut.isObjIdle(pObj)) return [];

  // Преобразовать в массив, ключ всегда преобразуется в id + newid
  const arr = transfromGenfieldObjToArray(pObj);

  // Сформировать данные по столбцам
  return formColumnVals(pitem.columns, arr);
}

function getGenfieldObjFromDataRecord(dataFromTable, table, pitem) {
  let rec;
  // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
  const recs = dataFromTable[table];
  if (Array.isArray(recs) && recs.length > 0) {
    rec = recs[0];
  }

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
        .map(prop => ({ id: prop, newid: prop, ...pObj[prop] }));
}

async function formColumnVals(columns, dataArr) {
  // Обработка полей типа droplist, подготовить списки
  const dropLists = await formDroplists(columns);

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = dataArr.map((item, idx) => {
    item.prop = item.prop || item.id;
    const row = { id: item.id || String(idx + 1) };

    columns.forEach(col => {
      if (col.type == 'link') {
        row[col.prop] = datagetter.formLinkObj(col, item, item[col.prop]);
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
      const listdata = datautil.getDroplist(item.data); // => {data:arr}
      droplists[item.prop] = listdata.data;
    }
  }
  return droplists;
}

function formDroplistValue(dropLists, prop, val) {
  return dropLists[prop] ? dropLists[prop].find(el => el.id == val) || '' : '';
}

module.exports = {
  formTableData,
  formColumnVals,
  formDroplistValue,
  getGenfieldObjFromDataRecord
};
