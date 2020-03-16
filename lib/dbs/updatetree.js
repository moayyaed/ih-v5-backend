/**
 * updatetree.js
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');
const appconfig = require('../appconfig');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const datautil = require('./datautil');
const numerator = require('./numerator');
const treeguide = require('./treeguide');
const updatecheck = require('./updatecheck');
const updateutil = require('./updateutil');

/**  update
 * Изменить (переместить) узел (узлы) в дереве
 *  Приходит nodeid, order и parentid; изменяется order и parentid 
 *  - Записать в таблицу
 *  - Вернуть массив изменений в формате дерева
 * 
 * @param {*} body 
 * 
 * {"method": "update",
    "type": "tree",
    "id": "dev",
    "payload": {
      "types": { // это имя поддерева
        "folders":[{"nodeid":"SensorD", "order":42}], // перемещение папки внутри ветки
        "nodes":[{"nodeid":"t200", "parentid":"SensorA", "order":75}]  // перемещение узла в другую ветку
      }
    }
   }
 * @return {Array}  массив изменений [{id, parent, order},...]
 */
async function update(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const res = []; // массив изменений
  const reorder = {};
  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid); // rootid - имя дерева

    // Рассчитать новые order для узла
    const treeObj = await dataformer.getCachedTree(rootid);

    // Внутри м б folders || nodes (или одновременно??)
    // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
    // !! За один раз сдвигаем один узел. Ну или вставляем несколько, но в одну точку??
    const theNode = getTheNode(payload, rootid);
    if (!theNode) continue;

    const targetObj = treeutil.findNodeById(treeObj, theNode.parentid); // Поддерево, куда копируем - это parent
    if (!targetObj) throw {err:'SOFTERR', message:'Not found parent node '+theNode.parentid};
    const { order, shifted } = await updateutil.processTheNodeOrder(targetObj.children, theNode, desc);

    if (theNode.order != order) {
      theNode.order = order;
      // Этот узел уже есть, его заново не отдаем интерфейсу, изменился order -> вcтавить в shifted
      if (shifted) shifted[theNode] = order;
    }
    if (shifted) Object.assign(reorder, shifted);

   
    // Внутри м б folders || nodes (или одновременно??)
    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
    if (payload[rootid].folders) {
      await updateNodes(rootid, payload[rootid].folders, desc.branch.table, parentCollection);
    }
    
    if (payload[rootid].nodes) {
      await updateNodes(rootid, payload[rootid].nodes, desc.leaf.table, parentCollection);
    }
  }
  // Вернуть изменения и reorder
  const result = { res };
  if (reorder && !hut.isObjIdle(reorder)) result.reorder = reorder;
  console.log('result '+util.inspect(result));
  return result;

  async function updateNodes(treeId, nodes, table, parentCollection) {
    console.log('updateNodes start ');
    const tdesc = descriptor.getDescItem('table', table);

    for (const item of nodes) {
      const doc = prepareTreeRecordForUpdate(item);
      console.log('updateNodes doc '+util.inspect(doc)+' item.nodeid '+item.nodeid);

      if (item.nodeid && doc) {
        // Если перемещение в другую папку - проверить, что папка существует
        if (doc.parent) await updatecheck.checkParent([doc], parentCollection, 'nolost');

        // Проверить, что перемещаемая запись существует и это не корневая папка
        // В случае неудачи - не удалось выполнить операцию
        const guideItem = treeguide.getItem(treeId, item.nodeid);
        if (!guideItem) throw { error: 'ERR', message: appconfig.getMessage('FolderRootOrNotFound') };
        if (!guideItem.parent) throw { error: 'ERR', message: appconfig.getMessage('FolderRootOrNotFound') };

        // Папку lost+found нельзя перемещать!
        if (updatecheck.isNodeLostFolder(item.nodeid))
          throw { error: 'ERR', message: appconfig.getMessage('FolderLostInvOper') };
         
        await dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: doc });
       
        res.push(Object.assign({ id: item.nodeid }, doc));
      }
    }
  }
}

function prepareTreeRecordForUpdate(item) {
  const res = {};
  if (item.order) res.order = item.order;
  if (item.parentid) {
    res.parent = item.parentid;
  }
  return hut.isObjIdle(res) ? '' : res;
}

/**  copypaste
 *  Копировать узел (узлы) (лист или папку) в дереве. Если папка - копируется все содержимое
 *  
 *  - Создать новые узлы как копии, генерировать новые id, записать в таблицу
 *  - Вернуть массив добавленных узлов в формате дерева (поддерево)
 *  - Если нужен сдвиг order для нижележащих узлов - также вернуть reorder
 * 
 * @param {*} body 
 * 
 * {"method": "copypaste",
    "type": "tree",
    "id": "dev",
    "nodeid":"ActorD", // целевой узел, куда нужно копировать
    "order":1000, // Точка вставки  (после этого узла) Если нет - копировать в конец
    "payload": {
      "types": { // это имя поддерева
        "folders":[{"nodeid":"SensorD"}], // нужно скопировать папку и все ее содержимое 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  // плюс отдельные листья
        "seq":["t200", "t201", "t203", "SensorD"] // Последовательность узлов
      }
    }
   }
 * @return {Object}  {res:[{id, parent, order}], data:[{id, parent, order, children:[{..}]}], reorder:{p109:5000, p110:6000}
 *   - res:массив добавлений (для обновления treeguide) 
 *   - data:  массив - добавленные узлы в виде поддерева для response 
 *   - reorder: объект с измененным order в редактируемой ветке ниже вставки - для response 
 */
async function copypaste(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const targetid = body.nodeid;
  const targetorder = body.order;

  if (!targetid) throw { err: 'SORTERR', message: 'Expected node as target id!' };
  // Копировать можно только из одного дерева
  if (Object.keys(payload).length > 1) throw { err: 'ERR', message: appconfig.getMessage('OnlyOneRootForCopy') };

  const res = []; // Массив изменений для treeguide
  const seqObj = {};
  let reorder;
  let l_array = [];
  const b_array = [];

  for (const rootid in payload) {
    const seq = payload[rootid].seq;
    const desc = descriptor.getDescItem('tree', rootid);
    const treeObj = dataformer.getCachedTree(rootid);

    // Рассчитать новые order для узлов
    const targetObj = treeutil.findNodeById(treeObj, targetid); // Поддерево, куда копируем
    // В массиве children найти элемент с order >= targetorder
    const { startOrder, delta, targetIdx, needReorder } = updateutil.calculateOrder(
      targetObj.children,
      targetorder,
      seq
    );

    // Если не смогли поместиться - нужно перенумеровать элементы следующие за targetIdx
    if (needReorder) {
      reorder = await updateutil.reordering(targetObj.children, targetIdx, desc, startOrder + seq.length * delta);
    }

    // order для копируемых узлов, исп copyNodes
    seq.forEach((el, idx) => {
      seqObj[el] = startOrder + delta * (idx + 1);
    });

    // простые листья
    if (payload[rootid].nodes) {
      const docs = await copyNodes(payload[rootid].nodes, desc.leaf.table, targetid);
      l_array = docs.map(doc => formArrayItem(doc));
    }

    // Папки - копировать все содержимое включая подпапки
    if (payload[rootid].folders) {
      for (const folder of payload[rootid].folders) {
        const branchObj = treeutil.findNodeById(treeObj, folder.nodeid); // Получить поддерево узла, который копируем
        await copyWithChildren(branchObj, desc.branch.table, desc.leaf.table, targetid);
      }
    }
  }

  // Вернуть вставленное поддерево и reorder
  const result = { res, data: treeutil.makeTreeWithLeaves(b_array, l_array) };
  if (reorder && !hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;

  async function copyNodes(nodes, table, target) {
    const tdesc = descriptor.getDescItem('table', table);

    // Считать записи, заменить parent на targetid, в название добавить (copy)
    const arr = nodes.map(item => item.nodeid);
    const filter = datautil.createIdsInFilter(arr);
    const docs = await dbstore.get(tdesc.collection, filter);

    if (docs.length > 0) {
      docs.forEach(doc => {
        doc.order = seqObj[doc._id] || 0;
        doc._id = numerator.getNewId(table);
        doc.parent = target;
        doc.name += ' (copy)'; // name+copy
        saveResItem(doc, table, 'leaf');
      });
      await dbstore.insert(tdesc.collection, docs);
    }
    return docs;
  }

  function saveResItem(doc, table, leaf) {
    res.push({ id: doc._id, title: doc.name, parent: doc.parent, table, leaf: leaf ? 1 : 0 });
  }

  async function copyOne(node, table, target) {
    const tdesc = descriptor.getDescItem('table', table);

    // Считать записи, заменить parent на targetid, в название добавить (copy)
    const doc = await dbstore.findOne(tdesc.collection, { _id: node.id });

    if (doc) {
      doc.order = seqObj[doc._id] || 0;
      doc._id = numerator.getNewId(table);
      doc.parent = target;
      doc.name += ' (copy)'; // name+copy
      await dbstore.insert(tdesc.collection, [doc]);
    }
    return doc;
  }

  async function copyWithChildren(node, branchTable, leafTable, target) {
    // Этот узел и все вложенные, если есть children
    const table = node.children ? branchTable : leafTable;
    const newDoc = await copyOne(node, table, target);

    if (table == branchTable) {
      b_array.push(formArrayItem(newDoc));
      saveResItem(newDoc, table);
    } else {
      l_array.push(formArrayItem(newDoc));
      saveResItem(newDoc, table, 'leaf');
    }

    if (!node.children || !node.children.length) return; // Это лист или пустая папка

    for (const child of node.children) {
      await copyWithChildren(child, branchTable, leafTable, newDoc._id);
    }
  }

  function formArrayItem(doc) {
    return { id: doc._id, order: doc.order, parent: doc.parent, title: doc.name };
  }
}


/**  insert
 * Добавить узел (узлы) в дерево
 *  Приходит order и parentid 
 *  - Сгенерировать id для узлов
 *  - Записать в таблицу
 *  - Вернуть массив изменений в формате дерева
 * 
 * @param {*} body 
 * Для дерева:
 * {"method": "insert",
    "type": "tree",
    "id": "dev",
    "payload": {
    "types": { // это имя поддерева
      "nodes":[{"parentid":"SensorD", "order":75, "popupid":"t230"}]
     }
    }
   }
 *
 * @return {Array}  массив изменений [{id, parent, order}]
 */
async function insert(body) {
  if (!body.payload) return;

  const payload = body.payload;

  const data = [];
  const reorder = {};
  for (const rootid in payload) {
    // Это имя поддерева
    const desc = descriptor.getDescItem('tree', rootid);
    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;

    const treeObj = dataformer.getCachedTree(rootid);

    // Внутри м б folders || nodes (или одновременно??)
    // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
    // !! За один раз вставляем один узел. Ну или вставляем несколько, но в одну точку??

    const theNode = getTheNode(payload, rootid);
    if (!theNode) continue;

    // Рассчитать новые order для узлов
    const targetObj = treeutil.findNodeById(treeObj, theNode.parentid); // Поддерево, куда копируем - это parent
    const { order, shifted } = await updateutil.processTheNodeOrder(targetObj.children, theNode, desc);

    if (theNode.order != order) theNode.order = order;
    if (shifted) Object.assign(reorder, shifted);

    await processNodes(payload[rootid].folders, desc.branch.table, parentCollection, desc.branch.propremap, 'folder');
    await processNodes(payload[rootid].nodes, desc.leaf.table, parentCollection, desc.leaf.propremap);
  }

  const result = { data };
 
  if (!hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;

  async function processNodes(nodes, table, parentCollection, propremap, folder) {
    if (nodes) {
      const docs = [];
      propremap = propremap || { id: '_id', title: 'name', parent: 'parent', order: 'order' };
      const tdesc = descriptor.getDescItem('table', table);

      const defRec = descriptor.getTableDefaultRecord(table);

      // Сформировать новые записи
      nodes.forEach(item => {
        const res = createOneTreeRecord(table, tdesc, item, defRec);
        if (res) docs.push(res);
      });

      // Проверить, что parent папки существуют
      await updatecheck.checkParent(docs, parentCollection, 'nolost');

      await dbstore.insert(tdesc.collection, docs);

      // На выход нужно title, order, id, children - нужно мапить
      docs.forEach(doc => {
        data.push(formOneTreeItem(doc, propremap, folder));
      });
    }
  }
}

function getTheNode(payload, rootid) {
  if (!payload[rootid]) return;
  if (!payload[rootid].folders && !payload[rootid].nodes) return;

  return payload[rootid].folders && payload[rootid].folders.length
    ? payload[rootid].folders[0]
    : payload[rootid].nodes[0];
}

function formOneTreeItem(item, propremap, folder) {
  const res = {};
  ['id', 'title', 'parent', 'order'].forEach(prop => {
    const rprop = propremap[prop];
    if (rprop && item[rprop] != undefined) res[prop] = item[rprop];
  });
  if (folder) res.children = [];
  return res;
}

function createOneTreeRecord(table, tdesc, item, defRec) {
  // item = {parentid, order}

  const id = numerator.getNewId(table);
  const doc = Object.assign({ _id: id, parent: item.parentid, order: item.order }, tdesc.filter, defRec);
  return doc;
}

/**
 *  Удалить узел (узлы) в дереве
 *  - Удалить в таблицах
 *  - Вернуть массивы удаленных и не удаленных узлов
 * 
 *   При удалении папки удалить все вложенные элементы
 * 
 * @param {*} body 
 * 
 * {"method": "remove",
    "type": "tree",
    "id": "dev",
    "payload": {
      "types": { // это имя поддерева
        "folders":[{"nodeid":"SensorD"}],
        "nodes":[{"nodeid":"t200"}]  
      }
    }
   }
 * @return {Object}  {removed:Array, notRemoved:Array}
 */
async function remove(body) {
  const payload = body.payload;
  const notRemoved = [];
  const removed = [];

  for (const rootid in payload) {
    const tree = await dataformer.getCachedTree(rootid);

    const leavesToDelete = [];
    const foldersToDelete = [];

    if (payload[rootid].nodes) {
      for (const item of payload[rootid].nodes) {
        if (item.nodeid) leavesToDelete.push(item.nodeid);
      }
    }

    if (payload[rootid].folders) {
      // Папки - удалить все содержимое включая подпапки
      // TODO - проверить, если папку удалить нельзя (корневая папка?)
      for (const folder of payload[rootid].folders) {
        const { b_arr, l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, folder.nodeid);
        foldersToDelete.push(...b_arr);
        leavesToDelete.push(...l_arr);
      }
    }

    // Удалить все листья и ветви для выбранного rootid
    const desc = descriptor.getDescItem('tree', rootid);

    const ldesc = descriptor.getDescItem('table', desc.leaf.table);
    await removeItems(leavesToDelete, ldesc.collection);
    removed.push(...leavesToDelete.map(el => ({ id: el })));

    const bdesc = descriptor.getDescItem('table', desc.branch.table);
    await removeItems(foldersToDelete, bdesc.collection);
    removed.push(...foldersToDelete.map(el => ({ id: el })));
  }
  return { removed, notRemoved };
}

async function removeItems(arr, collection) {
  const filter = datautil.createIdsInFilter(arr);
  return dbstore.remove(collection, filter, { multi: arr.length > 1 });
}

module.exports = {
  insert,
  update,
  remove,
  copypaste
};

/*

{"method": "insert",
  "type": "tree",
  "id": "dev",
  "payload": {
  "types": { // это имя поддерева
    "nodes":[{"parentid":"SensorD", "order":75, "popupid":"t230"}]
    }
  }
}

{
  "method": "copypaste",
  "type": "tree",
  "id": "dev",
  "nodeid": "SensorA",
  "order": 899,
  "payload": {
    "types": {
      "nodes": [
        {
          "nodeid": "t850"
        }
      ],
      "seq": [
        "t850"
      ]
    }
  }
}
*/
