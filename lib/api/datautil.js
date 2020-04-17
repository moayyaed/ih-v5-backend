const util = require('util');

const hut = require('../utils/hut');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

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

async function loadList(listname) {

  console.log('dm='+util.inspect(dm, null, 4))
  const listdesc = descriptor.getDescItem('list', listname);

  const desc = descriptor.getTableDesc(listdesc.table);
  const projection = hut.getFieldProjection(listdesc.propmap);
  const data = await dm.dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

  // Сделать маппинг полей и сохранить в liststore
  const arr = hut.mapPropsStrict(data, listdesc.propmap);
  liststore.addList(listname, listdesc.table, arr);
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


async function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';

  await getList(listdata);

  return liststore.getItemFromList(listdata, key);
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
  getEmptyValue,
  getList,
  getDeviceTitle,
  getDroplistItem,
  createIdsInFilter,
  loadList
};
