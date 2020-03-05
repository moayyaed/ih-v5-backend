
// const util = require('util');

const hut = require('../utils/hut');

const dbstore = require('../dbs/dbstore');
const descriptor = require('../dbs/descriptor');
const liststore = require('../dbs/liststore');


function getEmptyValue(type) {
  switch (type) {
    case 'number':
      return null;
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

  const listdesc = descriptor.getDescItem('list', id);
  const desc = descriptor.getTableDesc(listdesc.table);
  const projection = hut.getFieldProjection(listdesc.propmap);
  const data = await dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

  // Сделать маппинг полей и сохранить в liststore
  const arr = hut.mapProps(data, listdesc.propmap);
  liststore.addList(id, arr);

  return { data: arr };
}

async function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';

  await getList(listdata);

  return liststore.getItemFromList(listdata, key);
}

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
  getDroplistItem,
  createIdsInFilter


}