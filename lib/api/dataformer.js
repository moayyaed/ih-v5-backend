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

const tabledata = require('./tabledataformer');

const customcomponents = require('../appspec/customcomponents');
const datagetter = require('../appspec/datagetter');
const datamaker = require('../appspec/datamaker');
const smartbutton = require('../appspec/smartbutton');
const virttables = require('../appspec/virttables');
const projectdata = require('../appspec/projectdata');


/**
 * Возвращает данные для формы
 *
 * @param {String} id - идентификатор формы
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 *
 */
async function getRecordByForm(query, holder) {
  let { id, nodeid, rowid } = query;

  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await dm.getCachedData({ type: 'form', id, nodeid, method: 'getmeta' });
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};

  // Для некоторых форм (вызываемых из subtree) nodeid приходит не как _id записи, а как link (d0800.value)
  // - определить nodeid = _id записи на основании nodeid=d001.value или rowid - уже есть id записи из диалога например
  // То же самое нужно проделать при записи (update?)

  const preNodeid = nodeid;
  if (datautil.isLink(nodeid)) {
    nodeid = await datagetter.getRecordIdByLink(id, nodeid, rowid);
  }
  // console.log('preNodeid ' + preNodeid + ' nodeid=' + nodeid);

  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    if (formMetaData.breadcrumbs && formMetaData.breadcrumbs.tree) {
      const treeId = formMetaData.breadcrumbs.tree;
      // Проверить, что дерево загружено. Если нет - загрузить
      if (!treeguide.get(treeId)) {
        await getCachedTree(treeId);
      }
      data.breadcrumbs = nodeid ? await treeguide.getBreadcrumbs(treeId, nodeid) : [];
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (nodeid && cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table);
        if (desc.store == 'db') {
          dataFromTable[cell.table] = datautil.isNewRecord(nodeid)
            ? await datamaker.createOneRecord(cell.table, {}, {}, preNodeid, query)
            : await dm.dbstore.findOne(desc.collection, { _id: nodeid });
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

        if (datagetter.isRealtimeTable(cell.table)) {
          // Добавить данные для показа текущих значений - с каналов и/или с устройств
          dataFromTable.realtime = datagetter.getRealtimeValues(cell.table, id, nodeid, holder);
        }
      }
    }

    console.log('dataFromTable = ' + util.inspect(dataFromTable));

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
          // data[cell.id][item.prop] = await tabledata.get(dataFromTable, cell.table, nodeid, item, holder);
          data[cell.id][item.prop] = await getTableData(cell.table, item);
        } else if (item.prop == 'showhandlers') {
          data[cell.id][item.prop] = datagetter.showHandlersForType(nodeid);
        } else if (item.type == 'code') {
          // Вернуть код сценария из файла в виде строки?
          if (item.prop == 'handler') {
            data[cell.id][item.prop] = await loadsys.loadHandler(nodeid);
          } else {
            data[cell.id][item.prop] = await loadsys.loadScene(nodeid);
          }
        } else if (datautil.isExfieldtype(item.type)) {
          // Загрузить из файла в виде объекта - layout, container (возможно, из кэша??)
          data[cell.id][item.prop] = await projectdata.getCachedProjectObj(item.type, nodeid);
        } else if (item.type == 'smartbutton') {
          data[cell.id][item.prop] = await getSmartbuttonData(cell.table, item, nodeid);
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
    return dataFromTable[table] && dataFromTable[table] && dataFromTable[table][prop] != undefined;
  }

  async function getData(table, item) {
    if (dataFromTable[table] == undefined) throw { err: 'SOFTERR', message: 'Not found data from table: ' + table };
    if (!dataFromTable[table]) return '';

    const spec = ['droplist', 'text'];
    const value = dataFromTable[table][item.prop];
    if (!spec.includes(item.type)) return value;

    switch (item.type) {
      case 'text':
        return item.prop.endsWith('ts') ? tryFormDateString(value) : value;
      case 'droplist':
        return datautil.getDroplistItem(item.data, value);
      default:
        return '';
    }
  }

  async function getTableData(table, item) {
    return virttables[table]
      ? virttables[table](dataFromTable, table, nodeid, item, holder)
      : tabledata.formTableData(dataFromTable, table, nodeid, item);
    // return tabledata.get(dataFromTable, table, nodeid, item, holder);
  }

  async function getSmartbuttonData(table, item) {
    if (!item || !item.params) throw { err: 'SOFTERR', message: 'Expected params object for type:"smartbutton" ' };

    const dataItem = dataFromTable[table]
      ? Array.isArray(dataFromTable[table])
        ? dataFromTable[table][0]
        : dataFromTable[table]
      : '';

    return smartbutton.get(item.params.dialog, dataItem, preNodeid, rowid);
  }
}


function tryFormDateString(value) {
  if (!value || isNaN(value) || value < 946674000000) return value;
  try {
    return hut.getDateTimeFor(new Date(value), 'reportdt');
  } catch (e) {
    return value;
  }
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

  // Если ветви и листья в одной коллекция коллекции - исключить folder записи из листьев
  const l_temp = b_desc.collection == l_desc.collection ? dataArr[1].filter(item => !item.folder) : dataArr[1];
  const l_array = formTreeItemsArray(l_temp, desc.leaf);

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

  if (desc.expanded) {
    data[0].expanded = true;
  }
  return data;
}

function formTreeItemsArray(dataArr, desc) {
  dataArr.forEach(item => {
    item.title = datagetter.getTreeItemTitle(desc.table, item);
    if (desc.component) {
      item.component = datagetter.chooseTreeItemComponent(item, desc);
    }
  });
  return dataArr.map(item => Object.assign({}, hut.getStrictMappedObj(item, desc.propmap)));
}

async function getSubTree({ id, nodeid }) {
  if (customcomponents.subtree && customcomponents.subtree[id]) {
    return customcomponents.subtree[id](nodeid);
  }
  return getTree(id);
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
function formTreeAndGuideFromResDocs(res, treeId, subtree, navnodeid) {
  if (subtree) return formSubTreeAndGuideFromResDocs(res, treeId, navnodeid);

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

function formSubTreeAndGuideFromResDocs(res, treeId, navnodeid) {
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
          l_array.push(datagetter.formSubTreeLeafItem(doc, treeId, navnodeid));
          treeItems.push(Object.assign({ leaf: true }, item));
        }
      });
    }
  }
  return { tree: treeutil.makeTreeWithLeaves(b_array, l_array), treeItems };
}

// Сформировать изменения элемента дерева при изменении данных.
function getUpdatedTreeItem(table, doc) {
  if (!doc.$set) return '';
  
  const title = datagetter.getTreeItemTitle(table, doc.$set, doc);
  const res = { id: doc._id };
  if (title) res.title = title;
  if (doc.parent) res.parent = doc.parent;
  if (doc.order) res.order = doc.order;
  return !hut.isObjIdle(res) ? res : '';
}

async function getCachedTree(treeId) {
  const cachedObj = await dm.getCachedData({ type: 'tree', id: treeId }, getTree);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached tree ' + treeId };
  return cachedObj.data[0]; // Это массив, берем первый узел (элемент массива)
}

async function getCachedSubTree(treeId, nodeid) {
  const cachedObj = await dm.getCachedData({ type: 'subtree', id: treeId, nodeid }, getSubTree);
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
