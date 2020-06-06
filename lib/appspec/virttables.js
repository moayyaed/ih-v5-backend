/**
 *  virttables.js
 *  Экспортирует таблицу функций, которые вызываются для формирования виртуальных таблиц
 */

const hut = require('../utils/hut');
const dm = require('../datamanager');

const tabledata = require('../api/tabledataformer');
const datautil = require('../api/datautil');
const liststore = require('../dbs/liststore');

const datagetter = require('./datagetter');

/** ВИРТУАЛЬНЫЕ ТАБЛИЦЫ */
async function devicecommon(dataFromTable, table, nodeid, pitem, holder) {
  const arr = await tabledata.formTableData(dataFromTable, table, nodeid, pitem);

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
      item.type_op = {
        title: typeItem.props[item.prop].command ? 'Command' : typeItem.props[item.prop].op.toUpperCase(),
        path: typePath
      };
    }
    // Данные канала
    if (hObj[item.prop]) {
      const unit = hObj[item.prop].unit;
      const chan = hObj[item.prop].chan;
      item.unit = unit;
      item.chan = datagetter.formLinkObj(
        'devicecommonTable',
        { prop: 'chan' },
        { unit, chan, _id: hObj[item.prop]._id },
        chan
      );
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
  let pObj = tabledata.getGenfieldObjFromDataRecord(dataFromTable, table, pitem);
  if (!pObj) pObj = {};

  // Добавить свойства из types, если не все свойства сохранены (сохраняются только те, что редактируются)
  // Также нужно удалить свойство, если его уже нет в типе? Это делать на уровне редактирования типов??

  const typeItem = holder.devSet[nodeid] ? holder.devSet[nodeid].typeobj : {};
  const arr = [];
  typeItem.proparr.forEach(titem => {
    const prop = titem.prop;
    if (!titem.command) arr.push({ id: prop, newid: prop, ...pObj[prop] });
  });
  // Сформировать данные по столбцам
  return tabledata.formColumnVals(pitem.columns, arr);
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
    item.path = datautil.getPathFromTree('devdevices', item.id, 'place');
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
          row[col.prop] = datagetter.formLinkObj(table, col, item, item[col.prop]);
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
        row[col.prop] = datagetter.formLinkObj(table, col, item, value);
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

function getRealtimeVal(rtData, prop, item, idprop) {
  if (!rtData) return '';
  const id = item[idprop];
  if (!id || !rtData[id] || rtData[id][prop] == undefined) return '';

  const rtx = rtData[id][prop];

  return rtx > 0 && prop.endsWith('ts') ? hut.getDateTimeFor(new Date(rtx)) : rtx;
}

function formRows(table, arr, columns, dropLists) {
  return arr
    .filter(item => !item.folder)
    .map(item => {
      const row = { id: item._id };
      columns.forEach(col => {
        if (col.type == 'link') {
          row[col.prop] = datagetter.formLinkObj(table, col, item, item[col.prop]);
        } else if (col.type == 'droplist') {
          row[col.prop] = tabledata.formDroplistValue(col.prop, item[col.prop], dropLists);
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
  devicecommonTable: devicecommon,
  devicedbTable: devicedb,
  devicesTreeTable: devicestree,
  typesTreeTable: typestree,
  scenesTreeTable: scenestree,
  scenecall: scenecallForScene,
  typedevicesTable: typedevices,
  unitchannelsTable: unitchannels
};
