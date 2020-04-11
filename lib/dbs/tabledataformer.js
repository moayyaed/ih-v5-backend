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
  devicesTable: devices,

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

  // Преобразовать в массив, ключ всегда преобразуется в id?

  const arr = Array.isArray(pObj) ? pObj : hut.objectToArray(pObj, 'id');

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
        row[col.prop] = col.type == 'droplist' ? formDroplistValue(col.prop, item[col.prop]) : item[col.prop];
      } else {
        row[col.prop] = datautil.getEmptyValue(col.type);
      }
    });
    return row;
  });

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
  // const columns = pitem.columns;
  const arr = await formTableData(dataFromTable, table, nodeid, pitem);

  // Добавить данные каналов
  const hrec = await dbstore.get('devhard', { did: nodeid });

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

async function devices(dataFromTable, table, nodeid, pitem) {
  const arr = await dbstore.get('devices', { parent: nodeid });
  const columns = pitem.columns;
  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = formLinkObj(col, item, item[col.prop]);
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


async function unitchannels(dataFromTable, table, nodeid, pitem) {
  const arr = await dbstore.get('devhard', { unit: nodeid });
  const columns = pitem.columns;

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = formLinkObj(col, item, item[col.prop]);
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

function formRows(arr, columns ) {
  return arr
  .filter(item => !item.folder)
  .map(item => {
    const row = { id: item._id };
    columns.forEach(col => {
      if (col.type == 'link') {
        row[col.prop] = formLinkObj(col, item, item[col.prop]);
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

}

function formLinkObj(colItem, item, val) {
  if (!val) return { title: '', path: null };
  // Нужно сформировать title для устройства и для канала
  let path = null;
  switch (colItem.prop) {
    case 'dn':
      return getDeviceLinkObj(item._id);
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

