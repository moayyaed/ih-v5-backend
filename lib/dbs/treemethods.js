/**
 * treemethods.js
 *
 *  Подготовка данных для операций редактирования, вызванных из дерева
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
const updatecheck = require('./updatecheck');
const updateutil = require('./updateutil');
const devicemanager = require('../devices/devicemanager');

/**  insert
 *   Подготовка данных при добавлении узлов (записей) в дереве
 *  - Сформировать массив документов для добавления (приходит order и parentid)
 *
 *  - Вернуть :
 *    res - документ(ы), которые нужно добавить, сгруппированные по таблицам
 *    data - новые узлы дерева     
 *    reorder - массив узлов дерева, которые нужно сдвинуть при вставке  
 *   
 * @param {*} body 
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
 * @return {Object} - 
 *    {res:{<table>:{docs:[]}}
 *     reorder:[{id, order}]} 
 */
async function insert(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const res = {};
  const reorder = {};

  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid);
    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
    const treeObj = await dataformer.getCachedTree(rootid);

    // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
    // !! За один раз вставляем один узел. Ну или вставляем несколько, но в одну точку??
    const theNode = getTheNode(payload, rootid);
    if (!theNode) continue;

    // Рассчитать новые order для узлов, если вставить theNode
    const targetObj = treeutil.findNodeById(treeObj, theNode.parentid); // Поддерево, куда копируем - это parent
    const { order, shifted } = await updateutil.processTheNodeOrder(targetObj.children, theNode, desc);
    if (theNode.order != order) theNode.order = order;
    if (shifted) Object.assign(reorder, shifted);

    if (payload[rootid].folders && payload[rootid].folders.length) {
      res[desc.branch.table] = {
        docs: await createNewDocs(payload[rootid].folders, desc.branch.table, parentCollection)
      };
    }

    if (payload[rootid].nodes && payload[rootid].nodes.length) {
      res[desc.leaf.table] = { docs: await createNewDocs(payload[rootid].nodes, desc.leaf.table, parentCollection) };
    }
  }

  const result = { res };
  if (!hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;
}

async function createNewDocs(nodes, table, parentCollection) {
  if (!nodes) return;

  const docs = [];
  const tdesc = descriptor.getDescItem('table', table);
  const defRec = descriptor.getTableDefaultRecord(table);
  if (defRec) {
    for (const item of nodes) {
      const _id = numerator.getNewId(table);
      docs.push(Object.assign({ _id, parent: item.parentid, order: item.order }, tdesc.filter, defRec));
    }
  } else {
    for (const item of nodes) {
      const doc = await createOneRecord(table, tdesc, item);
      if (doc) docs.push(doc);
    }
  }
  // Проверить, что parent папки существуют. Если нет - уйдет по исключению
  await updatecheck.checkParent(docs, parentCollection, 'nolost');

  return docs;
}

function getTheNode(payload, rootid) {
  if (!payload[rootid]) return;
  if (!payload[rootid].folders && !payload[rootid].nodes) return;

  return payload[rootid].folders && payload[rootid].folders.length
    ? payload[rootid].folders[0]
    : payload[rootid].nodes[0];
}

async function createOneRecord(table, tdesc, item) {
  console.log('createOneRecord ' + table);
  const _id = numerator.getNewId(table);
  const doc = Object.assign({ _id, parent: item.parentid, order: item.order }, tdesc.filter);
  // ЗДЕСЬ можно делать разные вещи для таблиц
  switch (table) {
    case 'device':
      // Сформировать запись для нового устройства на основе типа
      // 1. props нужо сформировать по типу
      doc.props = devicemanager.createPropsFromType(item.popupid);

      // 2. dn и name по правилу из типа
      doc.dn = devicemanager.createDnFromType(item.popupid);
      doc.name = devicemanager.getNameFromType(item.popupid);
      break;

    default:
  }
  return doc;
}

/**  copy
 *  Копировать узел (узлы) (лист или папку) в дереве. Если папка - копируется все содержимое
 *  
 *  - Вернуть :
 *    res - документ(ы), которые нужно добавить, сгруппированные по таблицам
 *    data - новые узлы дерева     
 *    reorder - массив узлов дерева, которые нужно сдвинуть при вставке  
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
 * @return {Object} - 
 *    {res:{<table>:{docs:[]}}
 *     reorder:[{id, order}]} 
 */
async function copy(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const targetid = body.nodeid;
  const targetorder = body.order;

  if (!targetid) throw { err: 'SOFTERR', message: 'Expected "nodeid" as target id!' };

  // Копировать можно только из одного дерева
  if (Object.keys(payload).length > 1) throw { err: 'SOFTERR', message: appconfig.getMessage('OnlyOneRootForCopy') };

  const res = []; // Массив изменений для treeguide
  const seqObj = {};
  let reorder;

  for (const rootid in payload) {
    const seq = payload[rootid].seq;
    const desc = descriptor.getDescItem('tree', rootid);
    const treeObj = await dataformer.getCachedTree(rootid);

    // Рассчитать новые order для узлов
    const targetObj = treeutil.findNodeById(treeObj, targetid); // Поддерево, куда копируем
    if (!targetObj) throw { err: 'SOFTERR', message: 'Not found target node ' + targetid };

    // В массиве children найти элемент с order >= targetorder
    const { startOrder, delta, targetIdx, needReorder } = updateutil.calculateOrder(
      targetObj.children,
      targetorder,
      seq
    );
    console.log('copypaste startOrder=' + startOrder + ' delta=' + delta + ' needReorder=' + needReorder);

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
      res[desc.leaf.table] = {};
      res[desc.leaf.table].docs = await copyDocs(payload[rootid].nodes, desc.leaf.table, targetid, seqObj);
    }

    // Папки - копировать все содержимое включая подпапки
    if (payload[rootid].folders) {
      for (const folder of payload[rootid].folders) {
        const branchObj = treeutil.findNodeById(treeObj, folder.nodeid); // Получить поддерево узла, который копируем
        await copyWithChildren(branchObj, desc.branch.table, desc.leaf.table, targetid);
      }
    }
  }

  // const result = { res, data: treeutil.makeTreeWithLeaves(b_array, l_array) };
  const result = { res };
  if (reorder && !hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;

  // Функция в замыкании, так как пишет в res
  async function copyWithChildren(node, branchTable, leafTable, target) {
    // Этот узел и все вложенные, если есть children
    const table = node.children ? branchTable : leafTable;
    const newDoc = await copyOne(node, table, target, seqObj);

    if (!res[table]) res[table] = { docs: [] };
    res[table].docs.push(newDoc);

    if (!node.children || !node.children.length) return; // Это лист или пустая папка

    for (const child of node.children) {
      await copyWithChildren(child, branchTable, leafTable, newDoc._id);
    }
  }
}

async function copyDocs(nodes, table, target, seqObj) {
  const tdesc = descriptor.getDescItem('table', table);

  // Считать записи, заменить parent на targetid, в название добавить (copy)
  const arr = nodes.map(item => item.nodeid);
  const filter = datautil.createIdsInFilter(arr);
  const docs = await dbstore.get(tdesc.collection, filter);

  if (docs.length > 0) {
    docs.forEach(doc => copypasteDoc(table, doc, target, seqObj));
  }
  return docs;
}

async function copyOne(node, table, target, seqObj) {
  const tdesc = descriptor.getDescItem('table', table);
  const doc = await dbstore.findOne(tdesc.collection, { _id: node.id });

  if (doc) copypasteDoc(table, doc, target, seqObj);
  return doc;
}

function copypasteDoc(table, doc, target, seqObj) {
  const order = seqObj && seqObj[doc._id] ? seqObj[doc._id] : doc.order; // Старый id был прислан от интерфейса
  doc._id = numerator.getNewId(table);
  doc.parent = target;
  doc.name += ' (copy)'; // name+copy
  doc.order = order;
}

/**  update
 *  Изменить (переместить) узел (узлы) в дереве
 *  Приходит nodeid, order и parentid; изменяется order и parentid 
 *  - Вернуть :
 *    res - документ(ы), которые нужно изменить, сгруппированные по таблицам  
 *    reorder - массив узлов дерева, которые нужно сдвинуть при вставке  
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
 * @return {Object} - 
 *    {res:{<table>:{docs:[]}}
 *     reorder:[{id, order}]} 
 */
async function update(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const res = {};
  const reorder = {};
  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid);

    // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
    // !! За один раз сдвигаем один узел. Ну или вставляем несколько, но в одну точку??
    const treeObj = await dataformer.getCachedTree(rootid);
    const theNode = getTheNode(payload, rootid);
    if (!theNode) continue;

    const targetObj = treeutil.findNodeById(treeObj, theNode.parentid); // Поддерево, куда копируем - это parent
    if (!targetObj) throw { err: 'SOFTERR', message: 'Not found parent node ' + theNode.parentid };
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
      await formRes(payload[rootid].folders, desc.branch.table, parentCollection);
    }

    if (payload[rootid].nodes) {
      await formRes(payload[rootid].nodes, desc.leaf.table, parentCollection);
    }
  }
  // Вернуть изменения и reorder
  const result = { res };
  if (reorder && !hut.isObjIdle(reorder)) result.reorder = reorder;
  console.log('result ' + util.inspect(result));
  return result;

  async function formRes(nodes, table, parentCollection) {
    try {
      const tdesc = descriptor.getDescItem('table', table);
      res[table] = { docs: [] };

      for (const item of nodes) {
        console.log(' item '+ util.inspect(item));
        const _id = item.nodeid;
        if (!_id) continue;

        const doc = prepareDocForSet(item);
        if (!doc) continue;

        // Проверить, что перемещаемая запись существует и это не корневая папка
        const olddoc = await dbstore.findOne(tdesc.collection, { _id });

        if (!olddoc) throw new Error('Not found doc: _id = ' + _id + ', collection ' + tdesc.collection);
        if (!olddoc.parent) throw new Error(appconfig.getMessage('FolderRootOrNotFound'));

        // Если перемещение в другую папку - проверить, что целевая папка существует и не lost+found
        if (doc.parent) {
          updatecheck.checkIsNodeLostFolder(doc.parent);
          await updatecheck.checkOneRecordExists(parentCollection, doc.parent);
        }

        res[table].docs.push(Object.assign(olddoc, { $set: doc }));
      }
    } catch (e) {
      throw new Error('Update error: ' + util.inspect(e));
    }
  }
}

function prepareDocForSet(item) {
  const res = {};
  if (item.order) res.order = item.order;
  if (item.parentid) res.parent = item.parentid;
  return !hut.isObjIdle(res) ? res : '';
}

/**
 *  Подготовка данных при удалении узлов в дереве
 *  - Сформировать массив документов для удаления 
 *    При удалении папки должны удалиться все вложенные элементы
 * 
 *  - Проверка, что документ можно удалить 
 *  - Вернуть :
 *    res - документы, которые нужно удалить, сгруппированные по таблицам
 *          (в дереве папки и элементы хранятся в разных таблицах ) 
 *    notRemove - массив id узлов дерева, которые удалить нельзя      
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
 * @return {Object} - 
 *    {res:{<table1>:{docs:[]}, // docs - полные документы 
 *          <table2>:{docs:[]}},
 *      notRemove:[]} 
 */
async function remove(body) {
  const payload = body.payload;
  const notRemove = [];
  const res = [];

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
      // Папки - Выбрать все содержимое включая подпапки
      // TODO - проверить, если папку удалить нельзя (корневая папка?)
      for (const folder of payload[rootid].folders) {
        const { b_arr, l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, folder.nodeid);
        foldersToDelete.push(...b_arr);
        leavesToDelete.push(...l_arr);
      }
    }

    const desc = descriptor.getDescItem('tree', rootid);

    // Считать документы, которые нужно удалить
    if (leavesToDelete.length) {
      res[desc.leaf.table] = { docs: getDocsWithIds(desc.leaf.table, leavesToDelete) };
    }

    if (foldersToDelete.length) {
      res[desc.branch.table] = { docs: getDocsWithIds(desc.branch.table, foldersToDelete) };
    }
  }
  return { res, notRemove };
}

async function getDocsWithIds(table, idArray) {
  const filter = datautil.createIdsInFilter(idArray);
  const desc = descriptor.getDescItem('table', table);
  return dbstore.get(desc.collection, filter);
}

module.exports = {
  insert,
  copy,
  update,
  remove
};
