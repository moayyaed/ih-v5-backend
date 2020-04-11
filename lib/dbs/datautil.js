// const util = require('util');

const hut = require('../utils/hut');

const dbstore = require('../dbs/dbstore');
const descriptor = require('../dbs/descriptor');
const liststore = require('../dbs/liststore');

function getEmptyValue(type) {
  switch (type) {
    case 'number':
      return null;
    case 'layout':
      return {};
    case 'cb':
      return 0;
    case 'tags':
      return [];
    default:
      return '';
  }
}

/**
 * Возвращает список (droplist)
 * @param {String} id идентификатор (имя) списка
 *
 * Списки кэшируются в liststore
 * Описание списков (desc) находится в файле lists.json, который загружен в descriptor
 */
async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };

  return loadList(id);
}

async function loadList(id) {
  const listdesc = descriptor.getDescItem('list', id);

  const desc = descriptor.getTableDesc(listdesc.table);
  const projection = hut.getFieldProjection(listdesc.propmap);
  const data = await dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

  // Сделать маппинг полей и сохранить в liststore
  const arr = hut.mapPropsStrict(data, listdesc.propmap);
  liststore.addList(id, listdesc.table, arr);
  return { data: arr };
}

async function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';

  await getList(listdata);

  return liststore.getItemFromList(listdata, key);
}

async function getSmartbuttonItem(item) {
  // ПОКА ЗАГЛУШКА ДЛЯ devlink
  let title = '';
  let dialognodeid = null;
  let value = '';
  let did = '';
  let dn = '';
  let name = '';
  if (item.did) {
    dialognodeid = item.did;
    value = { did: item.did, prop: item.prop };

    // Здесь нужно имя устройства и имя свойства
    // Найти устройство: nodeid = devices._id
    const deviceDoc = await dbstore.findOne('devices', { _id: item.did });
    if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + item.did };
    did = item.did;
    dn = deviceDoc.dn;
    name = deviceDoc.name;
    title = getDeviceTitle(did) + ' ▪︎ ' + item.prop;
  }
  return {
    did,
    dn,
    name,
    prop: item.prop,
    title,
    dialognodeid,
    value,
    anchor: item.unit + '.' + item.chan
  };
}

function getDeviceTitle(did) {
  const item = liststore.getItemFromList('deviceList', did);
  return !item || !item.dn ? did + ': Device not found' : item.dn + ' ▪︎ ' + item.name;
}

/*
  {title:’DT1 Датчик температуры.value (значение)’, // Для показа в окне
    link:’modbus1.ch_1’, // Можно назвать более абстрактно, это нужно будет передавать при запросе devlcelink (например, selected?)
    dialognodeid:’d0772’. // id  узла в дереве диалога 
    fieldvalue:’d0772.value’ // Поле для отправки на сервер
    */

function createIdsInFilter(arr) {
  const filter = {};
  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
  }
  return filter;
}

module.exports = {
  loadList,
  getEmptyValue,
  getList,
  getDeviceTitle,
  getDroplistItem,
  getSmartbuttonItem,
  createIdsInFilter
};
