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
const ordering = require('./ordering');
const devicemanager = require('../devices/devicemanager');

/**  insert
 *   Подготовка данных при добавлении узлов (записей) в дереве
 *  - Сформировать массив документов для добавления (приходит order и возможно parentid)
 *
 *  - Вернуть :
 *    res - документ(ы), которые нужно добавить, сгруппированные по таблицам
 *    reorder - массив узлов дерева, которые нужно сдвинуть при вставке  
 *   
 * @param {*} body 
 * 
 * {"method": "insert", "type": "tree", "id": "dev",
    "payload": {
    "types": { // это имя поддерева 
      "nodes":[{"parentid":"SensorD", "order":75, "popupid":"t230"}]
   }}}

*  {"method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1"
    "payload": [{"parentid":"SensorD", "order":75, popupid:<'node'|'folder'>}]
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

  if (body.type == 'subtree') {
    const nodeid = body.navnodeid;
    if (!nodeid) throw { message: 'Expected navnodeid!' };
    if (!Array.isArray(payload)) throw { message: 'Expected payload as array!' };

    const desc = descriptor.getDescItem('tree', body.id);
    const treeObj = await dataformer.getCachedSubTree(body.id, nodeid);

    // !! За один раз вставляем один узел. Ну или вставляем несколько, но в одну точку??
    const theNode = payload[0];
    const { startOrder, delta, shifted } = await ordering.exec({
      treeObj: { children: treeObj },
      treeDesc: desc,
      parentid: theNode.parentid,
      order: theNode.order,
      qItems: payload.length
    });
    if (shifted) Object.assign(reorder, shifted);

    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
    const newDocs = payload.map((item, idx) => {
      const order = startOrder + delta * (idx + 1);
      const folder = item.popupid == 'folder' ? 1 : 0;
      return Object.assign(item, { parentid: item.parentid || 0, nodeid, order, folder });
    });

    res[desc.branch.table] = {
      docs: await createNewDocs(newDocs, desc.branch.table, parentCollection)
    };
  } else {
    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
      const treeObj = await dataformer.getCachedTree(rootid);

      // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
      // !! За один раз вставляем один узел. Ну или вставляем несколько, но в одну точку??
      const theNode = getTheNode(payload, rootid);
      if (!theNode) continue;

      const { startOrder, delta, shifted } = await ordering.exec({
        treeObj,
        treeDesc: desc,
        parentid: theNode.parentid,
        order: theNode.order,
        qItems: payload.length
      });
      if (shifted) Object.assign(reorder, shifted);

      // Если добавляется folders и nodes - нумеруем подряд
      let order = startOrder + delta;
      if (payload[rootid].folders && payload[rootid].folders.length) {
        payload[rootid].folders.forEach(el => {
          el.order = order;
          order += delta;
        });
        res[desc.branch.table] = {
          docs: await createNewDocs(payload[rootid].folders, desc.branch.table, parentCollection)
        };
      }

      if (payload[rootid].nodes && payload[rootid].nodes.length) {
        payload[rootid].nodes.forEach(el => {
          el.order = order;
          order += delta;
        });
        res[desc.leaf.table] = { docs: await createNewDocs(payload[rootid].nodes, desc.leaf.table, parentCollection) };
      }
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
  // await updatecheck.checkParent(docs, parentCollection, 'nolost');

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
  const _id = numerator.getNewId(table);
  const doc = Object.assign({ _id, parent: item.parentid, order: item.order }, tdesc.filter);
  // ЗДЕСЬ можно делать разные вещи для таблиц
  switch (table) {
    case 'device':
      console.log('devicemanager = ' + util.inspect(devicemanager));
      // Сформировать запись для нового устройства на основе типа
      // 1. props нужо сформировать по типу
      doc.props = devicemanager.createPropsFromType(item.popupid);

      // 2. dn и name по правилу из типа
      doc.dn = devicemanager.createDnFromType(item.popupid);
      doc.name = devicemanager.getNameFromType(item.popupid);
      break;

    case 'devhard':
      // Сформировать запись для канала
      // 1. props нужо сформировать по типу

      doc.unit = item.nodeid;
      if (item.folder) {
        doc.folder = 1;
        doc.chan = 'New folder';
      } else {
        doc.chan = 'New channel';
      }

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
  const res = [];
  const reorder = {};
  const payload = body.payload;
  const targetid = body.targetid;
  const targetorder = body.order ? body.order : 0; // Может придти null - null это объект!!
  if (!targetid) throw { err: 'SOFTERR', message: 'Expected "targetid" as target id!' };

  let seqObj;
  if (body.type == 'subtree') {
    const nodeid = body.navnodeid;
    if (!nodeid) throw { message: 'Expected navnodeid!' };

    const seq = payload.seq;
    const desc = descriptor.getDescItem('tree', body.id);
    const treeObj = await dataformer.getCachedSubTree(body.id, nodeid);

    // Рассчитать order для новых узлов. Определить, нужно ли сдвигать (shifted)
    const { startOrder, delta, shifted } = await ordering.exec({
      treeObj: { children: treeObj },
      treeDesc: desc,
      parentid: targetid,
      order: targetorder,
      qItem: seq.length
    });
    if (shifted) Object.assign(reorder, shifted);

    // order для копируемых узлов, seqObj исп docsToCopy
    seqObj = createSeqObj(startOrder, delta, seq);
    await docsToCopy({ children: treeObj }, payload, desc);
  } else {
    // Копировать можно только из одного дерева
    if (Object.keys(payload).length > 1) throw { err: 'SOFTERR', message: appconfig.getMessage('OnlyOneRootForCopy') };

    for (const rootid in payload) {
      const seq = payload[rootid].seq;
      const desc = descriptor.getDescItem('tree', rootid);
      const treeObj = await dataformer.getCachedTree(rootid);

      // Рассчитать order для новых узлов. Определить, нужно ли сдвигать (shifted)
      const { startOrder, delta, shifted } = await ordering.exec({
        treeObj,
        treeDesc: desc,
        parentid: targetid,
        order: targetorder,
        qItem: seq.length
      });

      if (shifted) Object.assign(reorder, shifted);
      // seqObj содержит новый order для копируемых узлов, исп docsToCopy
      seqObj = createSeqObj(startOrder, delta, seq);
      await docsToCopy(treeObj, payload[rootid], desc);
    }
  }

  const result = { res };
  if (reorder && !hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;

  async function docsToCopy(treeObj, payloadItem, desc) {
    // простые листья
    if (payloadItem.nodes) {
      res[desc.leaf.table] = { docs: await copyDocs(payloadItem.nodes, desc.leaf.table, targetid, seqObj) };
    }
    // Папки - копировать все содержимое включая подпапки
    if (payloadItem.folders) {
      for (const folder of payloadItem.folders) {
        const branchObj = treeutil.findNodeById(treeObj, folder.nodeid); // Получить поддерево узла, который копируем
        await copyWithChildren(branchObj, desc.branch.table, desc.leaf.table, targetid);
      }
    }
  }

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

function createSeqObj(startOrder, delta, seq) {
  const seqObj = {};
  seq.forEach((el, idx) => {
    seqObj[el] = startOrder + delta * (idx + 1);
  });
  return seqObj;
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
  if (table == 'devhard') {
    doc.chan += '_COPY';
  } else doc.name += ' (copy)'; // name+copy
  doc.order = order;
}

/**  update
 *  Изменить (переместить) узел (узлы) в дереве
 *  
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

  if (body.type == 'subtree') {
    console.log('tree.update ' + body.navnodeid);
    const nodeid = body.navnodeid;
    // payload:[{id, parentid, order}]
    if (!nodeid) throw { message: 'Expected navnodeid!' };
    if (!Array.isArray(payload)) throw { message: 'Expected payload as array!' };
    if (payload.length) {
      const desc = descriptor.getDescItem('tree', body.id);
      const treeObj = await dataformer.getCachedSubTree(body.id, nodeid);
      const theNode = payload[0];

      // Дерево без корня, treeObj - массив, поэтому смоделировать верхний уровень
      const { order, shifted } = await updateutil.getShifted({ children: treeObj }, theNode, desc);
      if (shifted) Object.assign(reorder, shifted);

      const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
      await formRes(payload, desc.branch.table, parentCollection);
    }
    return { reorder, res };
  }

  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid);
    const treeObj = await dataformer.getCachedTree(rootid);
    // Проверить, что после вставки узла не нужно передвигать order нижележащих узлов
    const { order, shifted } = await updateutil.getShifted(treeObj, getTheNode(payload, rootid), desc);
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
        console.log(' item ' + util.inspect(item));
        const _id = item.nodeid;
        if (!_id) continue;

        const doc = prepareDocForSet(item);
        if (!doc) continue;

        // Проверить, что перемещаемая запись существует и это не корневая папка
        const olddoc = await dbstore.findOne(tdesc.collection, { _id });

        if (!olddoc) throw new Error('Not found doc: _id = ' + _id + ', collection ' + tdesc.collection);
        // if (!olddoc.parent) throw new Error(appconfig.getMessage('FolderRootOrNotFound'));

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

  if (body.type == 'subtree') {
    const desc = descriptor.getDescItem('tree', body.id);
    await leavesToRemove(payload, desc);
    if (payload.folders) {
      const tree = await dataformer.getCachedSubTree(body.id, body.navnodeid);
      await foldersToRemove({ children: tree }, payload, desc);
    }
  } else {
    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      await leavesToRemove(payload[rootid], desc);
      if (payload[rootid].folders) {
        const tree = await dataformer.getCachedTree(rootid);
        await foldersToRemove(tree, payload[rootid], desc);
      }
    }
  }
  return { res, notRemove };

  async function leavesToRemove(payloadItem, desc) {
    const leavesToDelete = [];
    if (payloadItem.nodes) {
      for (const item of payloadItem.nodes) {
        if (item.nodeid) leavesToDelete.push(item.nodeid);
      }
    }

    // Считать документы, которые нужно удалить
    if (leavesToDelete.length) {
      res[desc.leaf.table] = { docs: await getDocsWithIds(desc.leaf.table, leavesToDelete) };
    }
  }

  async function foldersToRemove(tree, payloadItem, desc) {
    if (!payloadItem || !payloadItem.folders) return;
    const foldersToDelete = [];
    const leavesToDelete = [];

    // Папки - Выбрать все содержимое включая подпапки
    // TODO - проверить, если папку удалить нельзя (корневая папка?)
    for (const folder of payloadItem.folders) {
      const { b_arr, l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, folder.nodeid);
      foldersToDelete.push(...b_arr);
      leavesToDelete.push(...l_arr);
    }

    // Считать документы, которые нужно удалить
    if (desc.leaf.table == desc.branch.table) {
      leavesToDelete.push(...foldersToDelete);
      res[desc.leaf.table] = { docs: await getDocsWithIds(desc.leaf.table, leavesToDelete) };
    } else {
      if (leavesToDelete.length) {
        res[desc.leaf.table] = { docs: await getDocsWithIds(desc.leaf.table, leavesToDelete) };
      }

      if (foldersToDelete.length) {
        res[desc.branch.table] = { docs: await getDocsWithIds(desc.branch.table, foldersToDelete) };
      }
    }
  }
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
