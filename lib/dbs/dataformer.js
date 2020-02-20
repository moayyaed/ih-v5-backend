/**
 * dataformer.js
 * Загружает, формирует и кэширует данные
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');

const dbstore = require('../dbs/dbstore');
const descriptor = require('../dbs/descriptor');
const cache = require('../dbs/cache');
const loadsys = require('../dbs/loadsys');
const liststore = require('../dbs/liststore');
const tabledata = require('../dbs/tabledata');

async function get(type, id, nodeid, meta) {
  if (meta) return getMeta(type, id);

  // Форма записи таблицы  type=form'&id=formDeviceCommon&nodeid=xxxx
  if (type == 'form') return getRecordByForm(id, nodeid);

  // Форма записи таблицы  type=droplist'&id=typeList
  if (type == 'droplist') return getList(id);

  const desc = descriptor.getDescItem(type, id);
  if (type == 'tree') return Array.isArray(desc) ? loadMultiTree(id) : loadTree(id);

  return getSystemData(type, id);
}

async function getMeta(type, id) {
  const key = descriptor.getCacheKey(type, id, 'meta');
  const data = await loadsys.loadMeta(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function getList(id) {
  if (liststore.hasList(id)) return { data: liststore.getListAsArray(id) };

  // Нужно загрузить
  const listdesc = descriptor.getDescItem('list', id);
  const desc = descriptor.getTableDesc(listdesc.table);
  const projection = hut.getFieldProjection(listdesc.propmap);
  const data = await dbstore.get(desc.collection, {}, { order: 'name', fields: projection });

  // Сделать маппинг полей и сохранить в liststore
  const arr = hut.mapProps(data, listdesc.propmap);
  liststore.addList(id, arr);

  return { data: arr };
}

/**
 * Возвращает объект из системного файла данных
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор объекта
 *
 */
async function getSystemData(type, id) {
  const data = await loadsys.loadSystemData(type, id);
  const key = descriptor.getCacheKey(type, id);
  cache.set(key, data);
  return cache.get(key);
}

async function getRecordByForm(id, nodeid) {
  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await getMeta('form', id);
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};
  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    // Получить данные из таблиц для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки
      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);

        // Считать запись полностью
        dataFromTable[cell.table] = await dbstore.get(desc.collection, { _id: nodeid });
      }
    }

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      if (!cell.id) throw new Error('Expected "id" prop in grid item: ' + util.inspect(cell));
      if (!formMetaData[cell.id]) throw new Error('Not found grid item ' + cell.id + ' in form!');

      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          data[cell.id][item.prop] = await formTableData(item);
        } else if (cell.table && foundData(cell.table, item.prop)) {
          const val = getData(cell.table, item.prop);

          if (item.type == 'droplist') {
            data[cell.id][item.prop] = await getDroplistItem(item.data, val);
          } else {
            data[cell.id][item.prop] = val;
          }
        } else data[cell.id][item.prop] = '';
      }
    }
  } catch (e) {
    console.log(util.inspect(e));
    throw { error: 'SOFTERR', message: 'Unable prepare data for form ' + id + util.inspect(e) };
  }
  return { data };

  function foundData(table, prop) {
    return dataFromTable[table] && dataFromTable[table][0] && dataFromTable[table][0][prop] != undefined;
  }

  function getData(table, prop) {
    return dataFromTable[table][0][prop];
  }

  async function formTableData(item) {
    let tabdata = [];
    if (item.prop == 'devicecommonTable') {
      // tabdata = await tabledata.get('devicecommonTable', nodeid);
      tabdata = await getDeviceTable();
    } else if (item.prop == 'typepropsTable') {
      tabdata = await getTypeTable(item.columns);
    } else if (item.prop == 'channelTable') {
      tabdata = await getChannelTable();
    }

    // Обработка полей типа droplist
    const dropLists = item.columns.filter(el => el.type == 'droplist');

    tabdata.forEach(row => {
      dropLists.forEach((col, idx) => {
        const prop = col.prop;
        if (row[prop] != undefined) row[prop] = dropLists[idx].data.find(el => el.id == row[prop]);
        // await getDroplistItem(dropLists[idx].data, row[prop]); - может и из динамических таблиц
      });
    });
    return tabdata;
  }

  async function getChannelTable() {
    // Добавить данные каналов
    return dbstore.get('devhard', { unit: nodeid });
  }

  async function getTypeTable() {
    // Подготовить табличные данные
    // ЗАГЛУШКА
    const trec = await dbstore.get('types', { _id: nodeid });
    // props развести в массив
    const pObj = trec[0] && trec[0].props ? trec[0].props : '';
    if (!pObj) return [];
    const arr = hut.objectToArray(pObj, 'prop');

    return arr;
  }

  async function getDeviceTable() {
    // Подготовить табличные данные
    // ЗАГЛУШКА
    // Считать данные devprops
    const trec = await dbstore.get('devprops', { _id: nodeid });
    const arr = trec[0] && trec[0].aux ? trec[0].aux.map(aitem => aitem) : [];

    // Добавить данные каналов
    const hrec = await dbstore.get('devhard', { did: nodeid });
    const hObj = hut.arrayToObject(hrec, 'prop');

    arr.forEach(item => {
      if (hObj[item.prop]) {
        item.unit = hObj[item.prop].unit;
        item.chan = hObj[item.prop].chan;
        item.id = item.prop;
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
}

async function getDroplistItem(listdata, key) {
  if (Array.isArray(listdata)) return listdata.find(el => el.id == key) || '';

  await getList(listdata);

  return liststore.getItemFromList(listdata, key);
}

/*
function addMissingFields(data, fields) {
  data.forEach(item => {
    Object.keys(fields).forEach(prop => {
      if (item[prop] == undefined) {
        if (typeof fields[prop] == 'object') {
          item[prop] = hut.clone(fields[prop]);
        } else item[prop] = fields[prop];
      }
    });
  });
}
*/

/**
 * Возвращает объект с деревом, составленным из нескольких деревьев (несколько node с parent=0)
 *
 * @param {String} id - идентификатор дерева
 * @return {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]},
 *           {"id":22,"title":"Компоненты","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function loadMultiTree(id) {
  const desc = descriptor.getDescItem('tree', id);
  /*
  let data = [];
  let ts = 0;
 
  for (let treeId of desc) {
    const key = descriptor.getCacheKey('tree', treeId);
    if (!cache.has(key)) await loadTree(treeId);
    const cacheItem = cache.get(key);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
    data.push(cacheItem.data[0]);
  }
  */

  const promises = desc.map(treeId => {
    const key = descriptor.getCacheKey('tree', treeId);
    return cache.has(key) ? Promise.resolve(cache.get(key)) : loadTree(treeId);
  });

  const results = await Promise.all(promises);
  let data = [];
  let ts = 0;
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });

  return { data, ts };
}

/**
 * Возвращает объект с деревом (одно дерево)
 *    Данные берутся из таблиц
 *    Дерево также сохраняется в кэш
 * @param {String} id - идентификатор дерева
 * @return {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function loadTree(id) {
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = descriptor.getDescItem('table', desc.leaf.table);

  const dataArr = await Promise.all([
    dbstore.getData(Object.assign({}, b_desc, { order: 'order', fields: hut.getFieldProjection(desc.branch.propmap) })),
    dbstore.getData(Object.assign({}, l_desc, { order: 'order', fields: hut.getFieldProjection(desc.leaf.propmap) }))
  ]);

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap, desc.branch.propext);
  const l_array = hut.mapProps(dataArr[1], desc.leaf.propmap, desc.leaf.propext);
  let data = treeutil.makeTreeWithLeaves(b_array, l_array);

  if (data.length > 1) {
    treeutil.moveToLost(data, id);
  }

  // У корневого элемента прописать root - id дерева
  data[0].root = id;
  delete data[0].parent;
  delete data[0].list;

  // TODO ??? Обойти все children и проверить порядок (зазор между order)
  // Если есть проблемы - выполнить сдвиг внутри children, изменения сохранить и записать в db???

  // Сохранить результат в кэше
  const key = descriptor.getCacheKey('tree', id);
  cache.set(key, data);
  return cache.get(key);
}

module.exports = {
  get
};
