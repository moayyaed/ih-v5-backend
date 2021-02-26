/**
 * dataformer.js
 * Загружает, формирует и кэширует данные
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const treeutil = require('../utils/treeutil');
const loadsys = require('../utils/loadsys');

const appconfig = require('../appconfig');

const descriptor = require('../descriptor');

const datautil = require('./datautil');
const treeguide = require('./treeguide');

const tabledata = require('./tabledataformer');

const smartbutton = require('../appspec/smartbutton');
const projectdata = require('../appspec/projectdata');

const typestore = require('../device/typestore');
const handlerutil = require('../device/handlerutil');

/**
 * Возвращает данные для формы
 *
 * @param {String} id - идентификатор формы
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 *
 */
async function getRecordByForm(query, holder) {
  const dm = holder.dm;

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
    nodeid = await dm.datagetter.getRecordIdByLink(id, nodeid, rowid, dm);
  }
  // console.log('preNodeid ' + preNodeid + ' nodeid=' + nodeid);

  try {
    if (!formMetaData.grid) throw new Error('No "grid" prop in form!');

    if (formMetaData.breadcrumbs && formMetaData.breadcrumbs.tree) {
      const treeId = formMetaData.breadcrumbs.tree;
      // Проверить, что дерево загружено. Если нет - загрузить
      if (!treeguide.get(treeId)) {
        await getCachedTree(treeId, dm);
      }
      data.breadcrumbs = nodeid ? await treeguide.getBreadcrumbs(treeId, nodeid) : [];
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      if (nodeid && cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table) || { store: 'none' };

        if (desc.store == 'db') {
          dataFromTable[cell.table] = datautil.isNewRecord(nodeid)
            // {table, filter, item, parentid, body}
            ? await dm.datamaker.createOneRecord({table:cell.table, filter:{}, item:{}, parentid:preNodeid, body:query}, dm)
            : await dm.dbstore.findOne(desc.collection, { _id: nodeid });
        } else if (desc.store == 'tree') {
          // данные берем из дерева в форме плоской таблицы с полем  path
          // получить все листья из вложенных папок, затем в том же порядке их показать
          const treeRootItem = await getCachedTree(desc.tree, dm);

          const arr = await treeutil.getLeavesForTable(treeRootItem, nodeid);
          arr.forEach(item => {
            item.path = treeguide.getPath(desc.tree, item.id, nodeid);
          });
          // TODO - заменить на await getDataFromTree(desc.tree, nodeid)
          dataFromTable[cell.table] = arr;
        } else if (desc.store == 'none') {
          if (dm.datagetter.isVirttable(cell.table)) {
            dataFromTable[cell.table] = await dm.datagetter.getVirttable(cell.table, [], cell.table, nodeid, '', holder, id);
          }
        }

        if (dm.datagetter.isRealtimeTable(cell.table)) {
          // Добавить данные для показа текущих значений - с каналов и/или с устройств
          dataFromTable.realtime = dm.datagetter.getRealtimeValues(cell.table, id, nodeid, holder);
        }
      }
    }

    // console.log('dataFromTable = ' + util.inspect(dataFromTable));

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      data[cell.id] = {};
      for (const item of formMetaData[cell.id]) {
        if (item.type == 'table') {
          if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
          data[cell.id][item.prop] = await getTableData(cell.table, item);
        } else if (datautil.isDerivative(item.prop)) {
          data[cell.id][item.prop] = datautil.derivativeValue(item.prop, getRecord(cell.table));
        } else if (item.type == 'images') {
          data[cell.id][item.prop] = getIdArray(cell.table);
        } else if (item.type == 'image') {
          data[cell.id][item.prop] = getId(cell.table);
        } else if (item.prop == 'extlog') {
          data[cell.id][item.prop] = await getExtlog(item.param, nodeid);
        } else if (item.type == 'code' || item.type == 'script') {
          // Вернуть код из файла в виде строки
          if (item.prop == 'handler') {
            data[cell.id][item.prop] = await getHandler(cell.table, preNodeid);
          } else {
            data[cell.id][item.prop] = await loadsys.loadScene(nodeid);
          }
        } else if (datautil.isExfieldtype(item.type)) {
          // Загрузить из файла в виде объекта - layout, container (возможно, из кэша??)
          data[cell.id][item.prop] = await projectdata.getCachedProjectObj(item.type, nodeid, dm);
        } else if (item.type == 'smartbutton') {
          data[cell.id][item.prop] = await getSmartbuttonData(cell.table, item, nodeid);
        } else if (cell.table && foundData(cell.table, item.prop, preNodeid)) {
          data[cell.id][item.prop] = await getData(cell.table, item, preNodeid);
        } else if (item.default) {
          data[cell.id][item.prop] = item.default;
        } else data[cell.id][item.prop] = datautil.getEmptyValue(item.type);
      }
    }
  } catch (e) {
    throw { error: 'SOFTERR', message: 'Unable prepare data for form ' + id + util.inspect(e) };
  }

  // console.log('RESULT DATA = ' + util.inspect(data));
  return { data };


  async function getHandler(table, preId) {
    if (!preId) return '';
    if (preId.startsWith('api') || preId.startsWith('restapi')) return loadsys.loadRestapihandler(preId);

    if (table && table.startsWith('custom')) return handlerutil.getCustomHandler(table, preId);


    if (preId.indexOf('.')>0) {
      const [typeId, prop] = preId.split('.');
      return typestore.getHandlerStr(typeId, prop);
    }

    return '';
  }

  async function getExtlog(param, lid) {
    const logpath = appconfig.get('logpath');
    try {
      const logfile = param == 'dblog' ? logpath + '/ih_' + lid + '.log' : logpath + '/ih.log';
      const log = await fut.readLogTail(logfile, 16000);
      return log;
    } catch (e) {
      return hut.getShortErrStr(e);
    }
  }

  function foundData(table, prop, cNodeid) {
    // Если пришел массив - проверить первый элемент
    if (!dataFromTable[table]) return;
    let record = Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];
    if (record && datautil.isLink(cNodeid) && dm.datagetter.isVirttable(table)) {
      return true;
    }
    return record && record[prop] != undefined;
    // return dataFromTable[table] && dataFromTable[table] && dataFromTable[table][prop] != undefined;
  }

  function getRecord(table) {
    return Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];
  }

  async function getData(table, item, cNodeid) {
    if (dataFromTable[table] == undefined) throw { err: 'SOFTERR', message: 'Not found data from table: ' + table };
    if (!dataFromTable[table]) return '';

    const spec = ['droplist', 'text'];

    // Если пришел массив - взять из первого элемент
    // const record = Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];

    // Если пришел массив - взять из первого элемент
    let record = getRecord(table);
    if (datautil.isLink(cNodeid) && dm.datagetter.isVirttable(table)) {
      record = await dm.datagetter.getVirttable(table, dataFromTable, table, cNodeid, item, holder);
    }

    const value = record[item.prop];
    if (!spec.includes(item.type)) return value;

    switch (item.type) {
      case 'text':
        return item.prop.endsWith('ts') ? tryFormDateString(value) : value;
      case 'droplist':
        return dm.datagetter.getDroplistItem(item.data, value);
      default:
        return '';
    }
  }

  async function getTableData(table, item) {
    return dm.datagetter.isVirttable(table)
      ? dm.datagetter.getVirttable(table, dataFromTable, table, nodeid, item, holder)
      : tabledata.formTableData(dataFromTable, table, nodeid, item, holder);
    // return tabledata.get(dataFromTable, table, nodeid, item, holder);
  }

  function getIdArray(table) {
    // Формируется из таблицы, которая строится из tree
    // Не брать, если внутри вложенной папки
    // return dataFromTable[table] ? dataFromTable[table].filter(item => !item.path).map(item => item.id) : [];
    // БРАТЬ все, в том числе внутри вложенной папки
    return dataFromTable[table] ? dataFromTable[table].map(item => item.id) : [];
  }

  function getId(table) {
    return dataFromTable[table] ? dataFromTable[table].id || dataFromTable[table]._id : '';
  }

  async function getSmartbuttonData(table, item) {
    if (!item || !item.params) throw { err: 'SOFTERR', message: 'Expected params object for type:"smartbutton" ' };

    const dataItem = dataFromTable[table]
      ? Array.isArray(dataFromTable[table])
        ? dataFromTable[table][0]
        : dataFromTable[table]
      : '';

    // {dialog, dataItem, nodeid, rowid}
    return smartbutton.get({dialog: item.params.dialog, dataItem, nodeid: preNodeid, rowid}, dm);
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

async function getDataFromTree(treeId, nodeid, dm) {
  // данные берем из дерева в форме плоской таблицы с полем  path
  // получить все листья из вложенных папок, затем в том же порядке их показать
  const treeRootItem = await getCachedTree(treeId, dm);
  if (!treeRootItem) return [];

  const arr = await treeutil.getLeavesForTable(treeRootItem, nodeid);
  arr.forEach(item => {
    item.path = treeguide.getPath(treeId, item.id, nodeid);
  });
  return arr;
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
async function getTree({ id }, dm) {
  const desc = descriptor.getDescItem('tree', id);
  if (desc.data) return desc.data;

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = desc.leaf.table ? descriptor.getDescItem('table', desc.leaf.table) : '';
  if (!l_desc) return getBranchTree(id, desc, b_desc);

  const dataArr = await getDataArr(desc, b_desc, l_desc, dm);
  const b_array = hut.mapProps(
    b_desc.collection == l_desc.collection ? dataArr[0].filter(item => item.folder) : dataArr[0],
    desc.branch.propmap
  );

  if (desc.branch.component) {
    b_array.forEach(item => {
      item.component = dm.datagetter.chooseTreeItemComponent(item, desc.branch, dm);
    });
  }

  // Если ветви и листья в одной коллекции - исключить folder записи из листьев
  const l_temp = b_desc.collection == l_desc.collection ? dataArr[1].filter(item => !item.folder) : dataArr[1];
  const l_array = formTreeItemsArray(l_temp, desc.leaf, dm);

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

async function getBranchTree(id, desc, b_desc, dm) {
  const dataArr = [
    await dm.dbstore.getData(
      Object.assign({}, b_desc, { order: 'order', fields: hut.getFieldProjection(desc.branch.propmap) })
    )
  ];

  const b_array = hut.mapProps(dataArr[0], desc.branch.propmap);

  let data = treeutil.makeTreeWithLeaves(b_array, []);

  // У корневого элемента прописать root - id дерева
  data[0].root = id;
  delete data[0].parent;
  delete data[0].list;
  if (desc.expanded) {
    data[0].expanded = true;
  }
  return data;
}


async function getDataArr(desc, b_desc, l_desc, dm) {
  const promises =
    // передаю holder как {dm}
    l_desc.store == 'none'
      ? [dm.datagetter.getVirttable(desc.branch.table,'' , desc.branch.table, '', '', {dm} ),
         dm.datagetter.getVirttable(desc.leaf.table,'' , desc.leaf.table, '', '', {dm} ) 
        ]
      : [
          dm.dbstore.getData(
            Object.assign({}, b_desc, { order: 'order', fields: hut.getFieldProjection(desc.branch.propmap) })
          ),
          dm.dbstore.getData(
            Object.assign({}, l_desc, { order: 'order', fields: hut.getFieldProjection(desc.leaf.propmap) })
          )
        ];

  return Promise.all(promises);
}

function formTreeItemsArray(dataArr, desc, dm) {
  dataArr.forEach(item => {
    item.title = dm.datagetter.getTreeItemTitle(desc.table, item);
    if (desc.component) {
      item.component = dm.datagetter.chooseTreeItemComponent(item, desc, dm);
    }
  });
  return dataArr.map(item => Object.assign({}, hut.getStrictMappedObj(item, desc.propmap)));
}

async function getSubTree(query, dm) {
  /*
  if (customcomponents.subtree && customcomponents.subtree[id]) {
    return customcomponents.subtree[id](nodeid);
  }
  */
 const { id} = query;
  return dm.datagetter.isSpec('subtree', id) ? dm.datagetter.getSpecTree(query, dm) : getTree(id, dm);
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
function formTreeAndGuideFromResDocs(res, treeId, subtree, navnodeid, dm) {
  if (subtree) return formSubTreeAndGuideFromResDocs(res, treeId, navnodeid, dm);

  const desc = descriptor.getDescItem('tree', treeId);
  const treeItems = [];

  let b_array = [];
  let l_array = [];

  for (const table in res) {
    if (table == desc.branch.table) {
      const docs = res[table].docs.sort(hut.byorder('order'));
      b_array = formTreeItemsArray(docs, desc.branch, dm);
      treeItems.push(...b_array);
    }

    if (table == desc.leaf.table) {
      const docs = res[table].docs.sort(hut.byorder('order'));
      l_array = formTreeItemsArray(docs, desc.leaf, dm);
      if (l_array) {
        l_array.forEach(item => {
          treeItems.push(Object.assign({ leaf: true }, item));
        });
      }
    }
  }
  return { tree: treeutil.makeTreeWithLeaves(b_array, l_array), treeItems };
}

function formSubTreeAndGuideFromResDocs(res, treeId, navnodeid, dm) {
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
          l_array.push(dm.datagetter.formSubTreeLeafItem(doc, treeId, navnodeid));
          treeItems.push(Object.assign({ leaf: true }, item));
        }
      });
    }
  }
  return { tree: treeutil.makeTreeWithLeaves(b_array, l_array), treeItems };
}

// Сформировать изменения элемента дерева при изменении данных.
function getUpdatedTreeItem(table, doc, dm) {
  if (!doc.$set) return '';

  const title = dm.datagetter.getTreeItemTitle(table, doc.$set, doc);
  const res = { id: doc._id };
  if (title) res.title = title;
  if (doc.parent) res.parent = doc.parent;
  if (doc.order) res.order = doc.order;
  return !hut.isObjIdle(res) ? res : '';
}

async function getCachedTree(treeId, dm) {
  const cachedObj = await dm.getCachedData({ type: 'tree', id: treeId }, getTree);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached tree ' + treeId };
  return cachedObj.data[0]; // Это массив, берем первый узел (элемент массива)
}

async function getCachedSubTree(treeId, nodeid, dm) {
  const cachedObj = await dm.getCachedData({ type: 'subtree', id: treeId, nodeid }, getSubTree);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached subtree ' + treeId };
  return cachedObj.data; // Это массив
}

async function getImagegrid(nodeid) {
  const treeData = await getDataFromTree('images', nodeid);
  const data = treeData.map(item => item.id);
  return { data };
}

module.exports = {
  getRecordByForm,
  getTree,
  getSubTree,
  getCachedTree,
  getCachedSubTree,
  getUpdatedTreeItem,
  formTreeAndGuideFromResDocs,
  getImagegrid
};
