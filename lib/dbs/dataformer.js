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
const tabledata = require('../dbs/tabledataformer');
const datautil = require('../dbs/datautil');
const tagmanager = require('./tagstore');
const treeguide = require('./treeguide');

/**
 *  Получение данных по типу и идентификатору
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    После загрузки  сохраняются в кэше
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор по типу объекта
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 * @param {String || Boolean} meta - флаг загрузки метаданных
 * @return {Object}: {data}
 */
async function get(type, id, nodeid) {
  // Если данные кэшируются - сразу берем из кэша.
  let result;
  const key = descriptor.getCacheKey(type, id, '', nodeid);
  if (cache.has(key)) {
    result = cache.get(key);
    if (id == 'devices') {
      result.expanded = true;
    }
    return result;
  }

  const desc = descriptor.getDescItem(type, id);
  // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
  if (desc.store == 'db') {
    const data = await dbstore.getData(desc);
    return { data };
  }

  switch (type) {
    // type=form'&id=formDeviceCommon&nodeid=xxxx
    case 'form':
      return getRecordByForm(id, nodeid);

    // type=droplist'&id=typeList
    case 'droplist':
      return datautil.getList(id);

    case 'tags':
      return { data: tagmanager.getList() };

    // type=tree'&id=dev
    case 'tree':
      result = await getTree(id);
      if (id == 'devices') {
        result.expanded = true;
      }
      return result;

    case 'subtree':
      return getSubTree(id, nodeid);

    case 'popup':
      return id == 'plugincommand' ? getPopupPluginCommands(nodeid) : getPopupFromTree(id);

    case 'menu':
      return getSystemData(type, id);

    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
  }
}

// TODO заглушка  Нужно взять из манифеста плагина
async function getPopupPluginCommands(nodeid) {
  if (!nodeid) throw { message: 'Expected nodeid for type=popup&id=plugincommand' };
  return {
    data: [
      { id: 'command1_' + nodeid, title: 'Command 1 ' + nodeid },
      { id: 'command2_' + nodeid, title: 'Command 2 ' + nodeid },
      { id: 'command3_' + nodeid, title: 'Command 3 ' + nodeid }
    ]
  };
}

async function getMeta(type, id, nodeid) {
  const key = descriptor.getCacheKey(type, id, 'meta', nodeid);
  if (cache.has(key)) return cache.get(key);

  let data;
  if (id && id.indexOf('.') > 0) {
    data = await loadMetaForId(type, id);
  } else {
    data = await loadsys.loadMeta(type, id, nodeid);
  }

  if (nodeid && type == 'form') {
    // Доработать специфичные формы. И сохранить в кэше с учетом доработки для nodeid!!

    if (id == 'formPluginCommon') {
      // В форме нужно указать, что подставлять. Пока заглушка, меняю p2
      if (nodeid.startsWith('modbus')) {
        data.p2 = [
          { prop: 'ip', title: 'Modbus IP', type: 'input' },
          { prop: 'port', title: 'Port', type: 'input' }
        ];

        data.p3 = [
          {
            title: 'Channels',
            type: 'table',
            prop: 'unitchannelsTable',

            columns: [
              { prop: 'chan', title: 'Channel', type: 'string' },
              { prop: 'did', title: '$Device', type: 'string' },
              { prop: 'prop', title: '$DeviceProperty', type: 'string', readonly: true },
              { prop: 'address', title: 'Modbus Address', type: 'string' },
              { prop: 'vartype', title: 'Type', type: 'string' },
              { prop: 'fcr', title: 'Function', type: 'string' }
            ]
          }
        ];
      } else if (nodeid.startsWith('mqtt')) {
        data.p2 = [
          { prop: 'ip', title: 'MQTT broker URL', type: 'input' },
          { prop: 'port', title: 'MQTT broker Port', type: 'input' }
        ];
        data.p3 = [
          {
            title: 'Channels',
            type: 'table',
            prop: 'unitchannelsTable',

            columns: [
              { prop: 'chan', title: 'Channel', type: 'string' },
              { prop: 'did', title: '$Device', type: 'string' },
              { prop: 'prop', title: '$DeviceProperty', type: 'string', readonly: true },
              { prop: 'topic', title: 'Topic', type: 'string' },
              { prop: 'calc', title: 'Calculate', type: 'string' }
            ]
          }
        ];
      }
    }
  }

  cache.set(key, data);
  return cache.get(key);
}

async function loadMetaForId(type, id) {
  // id включает имя формы + id данных = channelview.modbus1
  const arr = id.split('.');
  if (arr.length < 2) throw { message: 'Failed getmeta! Unexpected id: ' + id + ' for type: ' + type };

  // Пока берется стандартная форма, здесь надо будет предусмотреть адаптацию формы для плагина (или даже канала?)
  let data = await loadsys.loadMeta(type, arr[0]);

  let fid = arr[1];

  if (arr[0] == 'channelview') {
    if (fid && fid.startsWith('modbus')) {
      data.p3 = [
        { prop: 'address', title: 'Modbus Address', type: 'input' },
        { prop: 'vartype', title: 'Type', type: 'input' },
        { prop: 'fcr', title: 'Function', type: 'input' }
      ];
    } else if (fid.startsWith('mqtt')) {
      data.p3 = [
        { prop: 'topic', title: 'Topic', type: 'input' },
        { prop: 'calc', title: 'Calculate', type: 'input' }
      ];
    }
  }

  return data;
}

async function getTree(id) {
  const desc = descriptor.getDescItem('tree', id);
  return Array.isArray(desc) ? getMultiTree(id) : loadTree(id);
}

async function getPopupFromTree(id) {
  const key = descriptor.getCacheKey('popip');

  const dataObj = await loadTree(id);

  cache.set(key, dataObj.data[0].children);
  return cache.get(key);
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

/**
 * Возвращает данные для формы
 *
 * @param {String} id - идентификатор формы
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 *
 */
async function getRecordByForm(id, nodeid) {
  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await getMeta('form', id, nodeid);
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};

  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    if (formMetaData.breadcrumbs && formMetaData.breadcrumbs.tree) {
      const treeId = formMetaData.breadcrumbs.tree;
      // Проверить, что дерево загружено. Если нет - загрузить
      if (!treeguide.get(treeId)) {
        await loadTree(treeId);
      }
      data.breadcrumbs = await treeguide.getBreadcrumbs(treeId, nodeid);
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);
        if (desc.store == 'db') {
          dataFromTable[cell.table] = await dbstore.get(desc.collection, { _id: nodeid });
        }
      }
    }

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
          data[cell.id][item.prop] = await tabledata.get(dataFromTable, cell.table, nodeid, item.columns);
        } else if (item.type == 'code') {
          // Вернуть код сценария из файла в виде строки?

          data[cell.id][item.prop] = await loadsys.loadScene(nodeid);
        } else if (cell.table && foundData(cell.table, item.prop)) {
          data[cell.id][item.prop] = await getData(cell.table, item);
        } else data[cell.id][item.prop] = datautil.getEmptyValue(item.type);
      }
    }
  } catch (e) {
    throw { error: 'SOFTERR', message: 'Unable prepare data for form ' + id + util.inspect(e) };
  }
  return { data };

  function foundData(table, prop) {
    return dataFromTable[table] && dataFromTable[table][0] && dataFromTable[table][0][prop] != undefined;
  }

  async function getData(table, item) {
    const val = dataFromTable[table][0][item.prop];
    if (item.type != 'droplist') return val;
    return datautil.getDroplistItem(item.data, val);
  }
}

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
async function getMultiTree(id) {
  const desc = descriptor.getDescItem('tree', id);

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

  return { data };
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

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap);

  // const l_array = hut.mapProps(dataArr[1], desc.leaf.propmap);

  const l_array = formTreeItemsArray(dataArr[1], desc.leaf);

  // Создать treeguide заново
  treeguide.create(id, b_array, l_array, desc);

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);
  if (data.length > 1) {
    const lostNode = treeutil.moveToLost(data, id);

    // Записать в корень дерева как последний children
    data[0].children.push(lostNode);

    // Изменить в treeguide

    treeguide.addItem(id, lostNode.id, { title: lostNode.title, parent: data[0].id, component: lostNode.component });

    lostNode.children.forEach(item => {
      treeguide.updateItem(id, item.id, { parent: lostNode.id });
    });
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

function formTreeItemsArray(dataArr, desc) {
  dataArr.forEach(item => {
    item.title = getTreeItemTitle(desc.table, item);
  });
  // return hut.mapProps(dataArr,desc.propmap);
  return dataArr.map(item => Object.assign({}, hut.getStrictMappedObj(item, desc.propmap)));
}

async function getSubTree(id, nodeid) {
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const docs = await dbstore.get(b_desc.collection, { unit: nodeid }, { order: 'order' });
  if (!docs) return [];
  const b_array = docs
    .filter(item => item.folder)
    .map(item => ({
      id: item._id,
      title: item.chan,
      parent: item.parent || 0,
      order: item.order,
      component: 'channelfolder.' + nodeid
    }));
  const l_array = docs
    .filter(item => !item.folder)
    .map(item => ({
      id: item._id,
      title: item.chan,
      parent: item.parent || 0,
      order: item.order,
      component: 'channelview.' + nodeid
    }));

  // Создать treeguide заново
  treeguide.create(id, b_array, l_array, desc);

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);

  if (data && data.length) {
    data.forEach(item => delete item.parent);
    data.sort(hut.byorder('order'));
  }

  return { data };
  // Сохранить результат в кэше
  // const key = descriptor.getCacheKey('subtree', id, nodeid);
  // cache.set(key, data);
  // return cache.get(key);
}

/**
 * Сформировать поддерево tree (массив с вложенными эл-тами) на основании добавленных (скопированных) документов
 * Также формируется массив узлов treeItems для формирования treeguide
 * @param {Object} res - object from dataprepare
 *        res:{
 *          <table>:{docs:[]},
 *          <table>:{docs:[]}}
 * @return {Object} - {tree, treeItems}
 */
function formTreeAndGuideFromResDocs(res, treeId, subtree) {
  if (subtree) return formSubTreeAndGuideFromResDocs(res, treeId);

  const desc = descriptor.getDescItem('tree', treeId);
  const treeItems = [];

  let b_array = [];
  let l_array = [];

  for (const table in res) {
    if (table == desc.branch.table) {
      const docs = res[table].docs.sort(hut.byorder('order'));
      b_array = formTreeItemsArray(docs, desc.branch);
      treeItems.push(...b_array);
    }

    if (table == desc.leaf.table) {
      const docs = res[table].docs.sort(hut.byorder('order'));
      l_array = formTreeItemsArray(docs, desc.leaf);
      if (l_array) {
        l_array.forEach(item => {
          treeItems.push(Object.assign({ leaf: true }, item));
        });
      }
    }
  }

  return { tree: treeutil.makeTreeWithLeaves(b_array, l_array), treeItems };
}

function formSubTreeAndGuideFromResDocs(res, treeId) {
  const desc = descriptor.getDescItem('tree', treeId);
  const treeItems = [];

  let b_array = [];
  let l_array = [];

  for (const table in res) {
    if (table == desc.branch.table) {
      const docs = res[table].docs.sort(hut.byorder('order'));
      docs.forEach(doc => {
        let item;
        item = { id: doc._id, title: doc.chan, order: doc.order, parent: doc.parent || 0 };
        if (doc.folder) {
          b_array.push(item);
          treeItems.push(item);
        } else {
          l_array.push(item);
          treeItems.push(Object.assign({ leaf: true }, item));
        }
      });
    }
  }

  return { tree: treeutil.makeTreeWithLeaves(b_array, l_array), treeItems };
}

/**
 * Сформировать вспомогательный объект для разбора формы и сохранить в кэш
 * @param {String} id - ид-р формы
 * @return {Object} Объект для разбора формы:
 * {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     },
     exfieldtype:{
      code:'file'  
     }
   }
 */
async function getMetaUpForm(id) {
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) return cache.get(key).data;

  const metaData = await getMeta('form', id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];
  const alloc = {}; // table->prop->cell
  const exfieldtype = {};

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (formMetaData[cell.id]) {
      const propMap = new Map();
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: cell.table, prop: item.prop });
          addAlloc(item.prop, item.columns, cell.id);
        } else if (item.type == 'code') {
          exfieldtype[item.prop] = 'code';
        } else if (cell.table) {
          // Если в плашке НЕ табличные данные
          if (!propMap.has(item.prop)) propMap.set(item.prop, item);
        }
      });
      if (propMap.size) {
        records.push({ cell: cell.id, table: cell.table });
        addAlloc(cell.table, formMetaData[cell.id], cell.id);
      }
    }
  }

  // Сохранить в кэш
  cache.set(key, { records, tables, alloc, exfieldtype });
  return cache.get(key).data;

  function addAlloc(table, arr, cellid) {
    if (!alloc[table]) alloc[table] = {};

    arr.forEach(item => {
      if (item.type != 'table') {
        alloc[table][item.prop] = cellid;
      }
    });
  }
}

// Сформировать изменения элемента дерева при изменении данных.
function getUpdatedTreeItem(table, doc) {
  const title = getTreeItemTitle(table, doc.$set, doc);
  const res = { id: doc._id };
  if (title) res.title = title;
  if (doc.parent) res.parent = doc.parent;
  if (doc.order) res.order = doc.order;
  return !hut.isObjIdle(res) ? res : '';
}

function getTreeItemTitle(table, item, olditem) {
  let title = item.name || (olditem && olditem.name ? olditem.name : '');
  if (table == 'device') {
    const dn = item.dn || (olditem && olditem.dn ? olditem.dn : '');
    title = dn + ' ' + title;
  } else if (table == 'units') {
    title = item._id || (olditem && olditem._id) || '';
  } else if (table == 'devhard') {
    title = item.chan || (olditem && olditem.chan) || '';
  }

  return title;
}

async function getCachedTree(treeId) {
  const key = descriptor.getCacheKey('tree', treeId);

  const cachedObj = await getTree(treeId); // {data, ts}
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached Obj for key=' + key };

  return cachedObj.data[0]; // Это массив, берем первый корень
}

async function getCachedSubTree(treeId, nodeid) {
  const key = descriptor.getCacheKey('tree', treeId);

  const cachedObj = await getSubTree(treeId, nodeid);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached Obj for key=' + key };

  return cachedObj.data; // Это массив
}

module.exports = {
  get,
  getMeta,
  getMetaUpForm,
  getTree,
  getCachedTree,
  getCachedSubTree,
  getUpdatedTreeItem,
  formTreeAndGuideFromResDocs,
  formSubTreeAndGuideFromResDocs
};
