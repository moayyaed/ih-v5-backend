/**
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');
const treeguide = require('./treeguide');

const descriptor = require('../descriptor');

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
async function getTree(query, dm) {
  console.log('TREE FORMER getTree query='+util.inspect(query))
  const { id } = query;
  if (dm.datagetter.isSpec('tree', id)) return dm.datagetter.getSpecTree(query, dm);

  const desc = descriptor.getDescItem('tree', id);
  if (desc.data) return desc.data;

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const l_desc = desc.leaf.table ? descriptor.getDescItem('table', desc.leaf.table) : '';
  if (!l_desc) return getBranchTree(id, desc, b_desc, dm);

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
    if (!data[0].children) data[0].children = [];
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

  console.log('TREE FORMER getTree data='+util.inspect(data))
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
      ? [
          dm.datagetter.getVirttable(desc.branch.table, '', desc.branch.table, '', '', { dm }),
          dm.datagetter.getVirttable(desc.leaf.table, '', desc.leaf.table, '', '', { dm })
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


async function getSubTree(query, dm) {
  const { id } = query;
  return dm.datagetter.isSpec('subtree', id) ? dm.datagetter.getSpecTree(query, dm) : getTree({ id }, dm);
}

function formTreeItemsArray(dataArr, desc, dm) {
  // console.log('formTreeItemsArray dataArr='+util.inspect(dataArr)+' desc.propmap='+util.inspect(desc.propmap))
  dataArr.forEach(item => {
    item.title = dm.datagetter.getTreeItemTitle(desc.table, item);
    if (desc.component) {
      item.component = dm.datagetter.chooseTreeItemComponent(item, desc, dm);
    }
    if (desc.copylink) {
      item.copylink = '![' + item._id + '](/images/' + item._id + ')';
    }
  });
  return dataArr.map(item => Object.assign({}, hut.getStrictMappedObj(item, desc.propmap), { link: item.link }));
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
          // b_array.push(item);
          b_array.push(dm.datagetter.formSubTreeBranchItem(doc, treeId, navnodeid));
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

async function getDataFromTree(treeId, fromnodeid, dm) {
  // данные берем из дерева в форме плоской таблицы с полем  path
  // получить все листья из вложенных папок, затем в том же порядке их показать
  // const treeRootItem = await getCachedTree(treeId, dm);
  const treeRootItem = await dm.getCachedTree({id:treeId});
  if (!treeRootItem) return [];

  if (!fromnodeid) fromnodeid = treeRootItem.id;
  if (!treeRootItem.id) return [];

  const arr = await treeutil.getLeavesForTable(treeRootItem, fromnodeid);
  arr.forEach(item => {
    item.path = treeguide.getPath(treeId, item.id, fromnodeid);
  });
  return arr;
}

module.exports = {
  getTree,
  getSubTree,
  formTreeAndGuideFromResDocs,
  getUpdatedTreeItem,
  getDataFromTree
};
