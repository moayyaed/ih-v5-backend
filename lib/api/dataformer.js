/**
 * dataformer.js
 * Загружает, формирует и кэширует данные
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');
const loadsys = require('../utils/loadsys');

const dm = require('../datamanager');
const descriptor = require('../descriptor');

const datautil = require('./datautil');
const treeguide = require('./treeguide');

const tabledata = require('./getutils/tabledataformer');

/**
 * Возвращает данные для формы
 *
 * @param {String} id - идентификатор формы
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 *
 */
async function getRecordByForm(id, nodeid) {
  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await dm.getCachedData({ type: 'form', id, nodeid, method: 'getmeta' });
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};

  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    if (formMetaData.breadcrumbs && formMetaData.breadcrumbs.tree) {
      const treeId = formMetaData.breadcrumbs.tree;
      // Проверить, что дерево загружено. Если нет - загрузить
      if (!treeguide.get(treeId)) {
        await getCachedTree(treeId);
      }
      data.breadcrumbs = await treeguide.getBreadcrumbs(treeId, nodeid);
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);
        if (desc.store == 'db') {
          dataFromTable[cell.table] = await dm.dbstore.get(desc.collection, { _id: nodeid });
        } else if (desc.store == 'tree') {
          // данные берем из дерева в форме плоской таблицы с полем  path
          // получить все листья из вложенных папок, затем в том же порядке их показать
          const treeRootItem = await getCachedTree(desc.tree);

          const arr = await treeutil.getLeavesForTable(treeRootItem, nodeid);
          arr.forEach(item => {
            item.path = treeguide.getPath(desc.tree, item.id, nodeid);
          });

          dataFromTable[cell.table] = arr;
        }
      }
    }

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
          // data[cell.id][item.prop] = await tabledata.get(dataFromTable, cell.table, nodeid, item.columns);
          data[cell.id][item.prop] = await tabledata.get(dataFromTable, cell.table, nodeid, item);
          // console.log('tabledata cell.id='+cell.id+' item.prop='+item.prop+' data='+data[cell.id][item.prop])
        } else if (item.type == 'code') {
          // Вернуть код сценария из файла в виде строки?

          data[cell.id][item.prop] = await loadsys.loadScene(nodeid);
        } else if (item.type == 'smartbutton') {
          data[cell.id][item.prop] = await getData(cell.table, item);
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
    const spec = ['droplist', 'smartbutton'];
    if (dataFromTable[table] == undefined) throw { err: 'SOFTERR', message: 'Not found data from table: ' + table };

    if (!spec.includes(item.type)) {
      return dataFromTable[table][0][item.prop];
    }

    switch (item.type) {
      case 'droplist':
        return datautil.getDroplistItem(item.data, dataFromTable[table][0][item.prop]);
      case 'smartbutton':
        return getSmartbuttonItem(dataFromTable[table][0]);
      default:
        return '';
    }
  }
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
    const deviceDoc = await dm.dbstore.findOne('devices', { _id: item.did });
    if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + item.did };
    did = item.did;
    dn = deviceDoc.dn;
    name = deviceDoc.name;
    title = datautil.getDeviceTitle(did) + ' ▪︎ ' + item.prop;
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
async function getTree({ id }) {
  console.log('TREE '+id);
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = descriptor.getDescItem('table', desc.leaf.table);

  const dataArr = await Promise.all([
    dm.dbstore.getData(
      Object.assign({}, b_desc, { order: 'order', fields: hut.getFieldProjection(desc.branch.propmap) })
    ),
    dm.dbstore.getData(Object.assign({}, l_desc, { order: 'order', fields: hut.getFieldProjection(desc.leaf.propmap) }))
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
  return data;
}

function formTreeItemsArray(dataArr, desc) {
  dataArr.forEach(item => {
    item.title = getTreeItemTitle(desc.table, item);
  });
  return dataArr.map(item => Object.assign({}, hut.getStrictMappedObj(item, desc.propmap)));
}

async function getSubTree({ id, nodeid }) {
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const docs = await dm.dbstore.get(b_desc.collection, { unit: nodeid }, { order: 'order' });
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
  return data;
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

  let title = item && item.name ? item.name : olditem && olditem.name ? olditem.name : '';
  if (table == 'device') {
    title = datautil.getDeviceTitle(item._id || olditem._id);
    // const dn = item.dn || (olditem && olditem.dn ? olditem.dn : '');
    // title = dn + ' ' + title;
  } else if (table == 'scene') {
    title = datautil.getSceneTitle(item._id || olditem._id);
  } else if (table == 'units') {
    title = item._id || (olditem && olditem._id) || '';
  } else if (table == 'devhard') {
    title = item.chan || (olditem && olditem.chan) || '';
  }
  return title;
}

async function getCachedTree(treeId) {
  const cachedObj = await dm.getCachedData({ type: 'tree', id: treeId }, getTree);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached tree ' + treeId };
  return cachedObj.data[0]; // Это массив, берем первый узел (элемент массива)
}

async function getCachedSubTree(treeId, nodeid) {
  const cachedObj = await dm.getCachedData({ type: 'tree', id: treeId, nodeid }, getSubTree);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached subtree ' + treeId };
  return cachedObj.data; // Это массив
}

module.exports = {
  getRecordByForm,
  getTree,
  getSubTree,
  getCachedTree,
  getCachedSubTree,
  getUpdatedTreeItem,
  formTreeAndGuideFromResDocs,
  formSubTreeAndGuideFromResDocs
};
