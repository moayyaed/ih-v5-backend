/**
 * Формирует таблицы для форм
 */

const util = require('util');

const hut = require('../../utils/hut');
const dm = require('../../datamanager');
const descriptor = require('../../descriptor');

const datautil = require('../datautil');
const liststore = require('../../dbs/liststore');
const treeguide = require('../treeguide');

const virtTables = {
  devicecommonTable: devicecommon,
  devicedbTable: devicedb,
  devicesTreeTable: devicestree,
  typesTreeTable: typestree,
  scenesTreeTable: scenestree,
  scenecall: scenecallForScene,
  typedevicesTable: typedevices,
  unitchannelsTable: unitchannels
};

exports.get = async function(dataFromTable, table, nodeid, item, holder) {
  return virtTables[table]
    ? virtTables[table](dataFromTable, table, nodeid, item, holder)
    : formTableData(dataFromTable, table, nodeid, item);
};

async function formTableData(dataFromTable, table, nodeid, pitem) {
  /*
  let rec;
  // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
  const recs = dataFromTable[table];
  if (Array.isArray(recs) && recs.length > 0) {
    rec = recs[0];
  }

  const desc = descriptor.getTableDesc(table);
  let genfield = pitem.genfield || desc.genfield;
  */

  const pObj = getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj) return [];

  // Преобразовать в массив, ключ всегда преобразуется в id + newid
  const arr = transfromGenfieldObjToArray(pObj);

  // Сформировать данные по столбцам
  return formColumnVals(pitem.columns, arr);

  /*
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
  */
}

function getGenfieldObjFromDataRecord(dataFromTable, table, pitem) {
  let rec;
  // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
  const recs = dataFromTable[table];
  if (Array.isArray(recs) && recs.length > 0) {
    rec = recs[0];
  }

  const desc = descriptor.getTableDesc(table);
  let genfield = pitem.genfield || desc.genfield;

  return rec && rec[genfield] ? rec[genfield] : '';
}

function transfromGenfieldObjToArray(pObj) {
  return Array.isArray(pObj) ? pObj : Object.keys(pObj).filter(prop => pObj[prop]).map(prop => ({ id: prop, newid: prop, ...pObj[prop] }));
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

      const listdata = datautil.getDroplist(item.data); // => {data:arr}
      droplists[item.prop] = listdata.data;
    }
  }
  return droplists;
}

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */

async function devicecommon(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await formTableData(dataFromTable, table, nodeid, pitem);

  // Добавить данные каналов
  const hrec = await dm.dbstore.get('devhard', { did: nodeid });
  const hObj = hut.arrayToObject(hrec, 'prop');

  // Добавить свойства типа
  const typePath = 'dev/types/typeview/' + holder.devSet[nodeid].type + '/tabTypeCommon';
  const typeItem = holder.devSet[nodeid] ? holder.devSet[nodeid].typeobj : {};

  arr.forEach(item => {
    item.prop = item.id;
    // Из типа
    if (typeItem.props[item.prop]) {
      item.type_propname = { title: typeItem.props[item.prop].name, path: typePath };
      item.type_vtype = { title: typeItem.props[item.prop].vtype, path: typePath };
      item.type_op = { title: typeItem.props[item.prop].op.toUpperCase(), path: typePath };
    }
    // Данные канала
    if (hObj[item.prop]) {
      const unit = hObj[item.prop].unit;
      const chan = hObj[item.prop].chan;
      item.unit = unit;
      item.chan = formLinkObj('devicecommonTable', { prop: 'chan' }, { unit, chan, _id: hObj[item.prop]._id }, chan);
    }

    // Добавить текущее состояние
    if (dataFromTable.realtime[item.prop]) {
      const dItem = dataFromTable.realtime[item.prop];
      item.realtime_dev_val = dItem.realtime_dev_val;
      item.realtime_dev_ts = dItem.realtime_dev_ts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_ts)) : '';
      item.realtime_dev_cts = dItem.realtime_dev_cts > 0 ? hut.getDateTimeFor(new Date(dItem.realtime_dev_cts)) : '';
      item.realtime_dev_err = dItem.realtime_dev_err;
    }
  });

  return arr;
}

async function devicedb(dataFromTable, table, nodeid, pitem, holder) {
  let pObj = getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj) pObj = {};

  // Добавить свойства из types, если не все свойства сохранены (сохраняются только те, что редактируются)
  // Также нужно удалить свойство, если его уже нет в типе
  const typeItem = holder.devSet[nodeid] ? holder.devSet[nodeid].typeobj : {};
 
  typeItem.proparr.forEach(titem => {
    const prop = titem.prop;
    if (!pObj[prop]) {
      pObj[prop] = {prop};
    }
  });

  Object.keys(pObj).forEach(prop => {
    if (!typeItem.props[prop]) {
      pObj[prop] = '';
    }
  });


  // Преобразовать в массив, ключ всегда преобразуется в id + newid
  const arr = transfromGenfieldObjToArray(pObj);
  // Сформировать данные по столбцам
  return formColumnVals(pitem.columns, arr);
}

// Таблицы получаем из дерева, поля id, title, path, остальные значения из списка
async function typestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item, typeList.get(item.id)));
  return formRows(table, arr, pitem.columns);
}

async function scenestree(data, table, nodeid, pitem) {
  // const typeList = liststore.getListMap('typeList');
  const arr = data[table].map(item => Object.assign({ _id: item.id, name: item.title }, item));
  return formRows(table, arr, pitem.columns);
}

async function devicestree(data, table, nodeid, pitem) {
  const typeList = liststore.getListMap('typeList');
  const deviceList = liststore.getListMap('deviceList');

  const arr = data[table].map(item => {
    const devItem = deviceList.get(item.id);
    const typeTitle = devItem && devItem.type && typeList.has(devItem.type) ? typeList.get(devItem.type).title : '';
    return Object.assign({ _id: item.id, 'type#title': typeTitle }, item, devItem);
  });
  return formRows(table, arr, pitem.columns);
}

// Таблица устройств заданного типа
async function typedevices(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('devices', { type: nodeid });

  arr.forEach(item => {
    item.id = item._id;
    item.did = item._id;
    item.path = treeguide.getPath('devdevices', item.id, 'place');
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
        } else if (col.prop.startsWith('realtime_')) {
          row[col.prop] = dataFromTable.realtime ? getRealtimeVal(dataFromTable.realtime, col.prop, item, 'chan') : '';
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

function getRealtimeVal(rtData, prop, item, idprop) {
  if (!rtData) return '';
  const id = item[idprop];
  if (!id || !rtData[id] || rtData[id][prop] == undefined) return '';

  const rtx = rtData[id][prop];

  return rtx > 0 && prop.endsWith('ts') ? hut.getDateTimeFor(new Date(rtx)) : rtx;
}

async function scenecallForScene(dataFromTable, table, nodeid, pitem) {
  const arr = await dm.dbstore.get('scenecalls', { sid: nodeid });
  const columns = pitem.columns;

  // Здесь все поля с droplist из deviceList
  const dropList = datautil.getDroplist('deviceList').data;

  // Уточнить состав полей, сформировать объекты для droplist
  const tdata = arr.map(item => {
    const row = { id: item._id };
    columns.forEach(col => {
      const value = item[col.prop];
      console.log(col.prop + ' =' + value);
      if (col.type == 'link') {
        row[col.prop] = formLinkObj(table, col, item, value);
      } else if (col.type == 'droplist') {
        row[col.prop] = dropList.find(el => el.id == value) || '';
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
  if (table.indexOf('scenes') >= 0)
    return { title: item.title, path: 'scenes/scenes/scenescript/' + id + '/tabSceneScript' };

  if (table.indexOf('device') >= 0) return getDeviceLinkObj(item.id);
  return { title: item.title, path: '' };
}

function getTypeLinkObj(table, id, item) {
  // Тип устройства
  // Название типа взято из справочника типов при подготовке данных
  if (table.indexOf('device') >= 0 && item.type)
    return { title: item['type#title'], path: 'dev/types/typeview/' + item.type + '/tabTypeCommon' };

  return { title: '', path: '' };
}
