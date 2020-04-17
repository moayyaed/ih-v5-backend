/**
 * Формирует таблицы для форм
 */

const util = require('util');

const hut = require('../../utils/hut');
const dm = require('../../datamanager');
const descriptor = require('../../descriptor');

const datautil = require('../datautil');
const liststore = require('../../dbs/liststore');

const virtTables = {
  devicecommonTable: devicecommon,
  devicesTreeTable: devicestree,
  typesTreeTable: typestree,

  unitchannelsTable: unitchannels
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

  const pObj = rec && rec[genfield] ? rec[genfield] : '';
  if (!pObj) return [];

  // Преобразовать в массив, ключ всегда преобразуется в id + newid
  const arr = Array.isArray(pObj) ? pObj : Object.keys(pObj).map(prop => ({ id: prop, newid: prop, ...pObj[prop]}));
 

  // Обработка полей типа droplist, подготовить списки
  const dropLists = await formDroplists(columns);

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr.map((item, idx) => {
    item.prop = item.prop || item.id;
    const row = { id: item.id || String(idx + 1) };

    columns.forEach(col => {
      if (col.type == 'link') {
        row[col.prop] = formLinkObj(col, item, item[col.prop]);
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
      const listdata = await datautil.getList(item.data); // => {data:arr}
      droplists[item.prop] = listdata.data;
    }
  }
  return droplists;
}

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

async function devicecommon(dataFromTable, table, nodeid, pitem) {
  // const columns = pitem.columns;
  const arr = await formTableData(dataFromTable, table, nodeid, pitem);

  // Добавить данные каналов
  const hrec = await dm.dbstore.get('devhard', { did: nodeid });

  const hObj = hut.arrayToObject(hrec, 'prop');

  arr.forEach(item => {
    item.prop = item.id;
    if (hObj[item.prop]) {
      const unit = hObj[item.prop].unit;
      const chan = hObj[item.prop].chan;
      item.unit = unit;
      item.chan = formLinkObj({ prop: 'chan' }, { unit, chan, _id: hObj[item.prop]._id }, chan);
      // item.chan = hObj[item.prop].chan;
    }
  });

  // Добавить текущее состояние
  const crec = await dm.dbstore.get('devcurrent', { _id: nodeid });

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

// Таблицы получаем из дерева, поля id, title, path, остальные значения из списка
async function typestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  return formRows(table, arr, pitem.columns);
}

async function devicestree(data, table, nodeid, pitem) {
  console.log('devicestree START');

  const typeList = liststore.getListMap('typeList');
  console.log('devicestree typeList ='+util.inspect(typeList));
  const deviceList = liststore.getListMap('deviceList');

  const arr = data[table].map(item => {
    const devItem = deviceList.get(item.id);
    const typeTitle = devItem && devItem.type && typeList.has(devItem.type) ? typeList.get(devItem.type).title : '';
    return Object.assign({ _id: item.id, "type#title":typeTitle }, item, devItem);
  });
  return formRows(table, arr, pitem.columns);
}

async function unitchannels(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('devhard', { unit: nodeid });
  const columns = pitem.columns;

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = formLinkObj(table, col, item, item[col.prop]);
          // } else if (item[col.prop] != undefined) {
          //  row[col.prop] = col.type == 'droplist' ? formDroplistValue(col.prop, item[col.prop]) : item[col.prop];
        } else if (item[col.prop] != undefined) {
          row[col.prop] = item[col.prop];
        } else {
          row[col.prop] = datautil.getEmptyValue(col.type);
        }
      });
      return row;
    });
  return tdata;
}

function formRows(table, arr, columns, dropLists) {
  return arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = formLinkObj(table, col, item, item[col.prop]);
        } else if (col.type == 'droplist') {
          row[col.prop] = formDroplistValue(col.prop, item[col.prop], dropLists);
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

function formDroplistValue(dropLists, prop, val) {
  return dropLists[prop] ? dropLists[prop].find(el => el.id == val) || '' : '';
}

function formLinkObj(table, colItem, item, val) {
  if (!val) return { title: '', path: '' };
  // Нужно сформировать title для устройства и для канала
  let path = '';
  switch (colItem.prop) {
    case 'title':
      return getTitleLinkObj(table, item.id, item);
    // return table.indexOf('device')>=0 ?  getDeviceLinkObj(item.id) : { title: val, path };
    case 'dn':
      return getDeviceLinkObj(item._id);
    case 'type':
      return getTypeLinkObj(table, item._id, item);  
    case 'did':
      return { title: datautil.getDeviceTitle(val), path: 'dev/devices/deviceview/' + val + '/tabDeviceCommon' };
    case 'chan':
      path = `datasource/plugins/pluginview/${item.unit}/tabUnitChannels/channelview.${item.unit}/${item._id}`;
      return { title: `${item.unit}.${item.chan}`, path };
    default:
      return { title: val, path };
  }
  // return {title:val, path:'dev/devices/deviceview/'+val+'/tabDeviceCommon'}
}

function getDeviceLinkObj(did) {
  return { title: datautil.getDeviceTitle(did), path: 'dev/devices/deviceview/' + did + '/tabDeviceCommon' };
}

function getTitleLinkObj(table, id, item) {
  if (table.indexOf('types') >= 0) return { title: item.title, path: 'dev/types/typeview/' + id + '/tabTypeCommon' };

  if (table.indexOf('device') >= 0) return getDeviceLinkObj(item.id);
  return { title: item.title, path: '' };
}


function getTypeLinkObj(table, id, item) {
  // Тип устройства 
  // Название типа взято из справочника типов при подготовке данных
  if (table.indexOf('device') >= 0 && item.type) return { title: item["type#title"], path: 'dev/types/typeview/' + item.type + '/tabTypeCommon' };

  return { title: '', path: '' };
}