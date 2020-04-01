/**
 * treemethods.js
 *  Подготовка данных для операций редактирования, вызванных из дерева
 *    method: insert | copypaste | update | remove
 *    type: tree | subtree
 */

const util = require('util');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const datautil = require('./datautil');
const numerator = require('./numerator');
const updatecheck = require('./updatecheck');
const ordering = require('./ordering');
const devicemanager = require('../devices/devicemanager');

/**  insert
 *   Подготовка данных при добавлении узлов (записей) в дереве
 *  - Сформировать массив документов для добавления
 *
 *  - Вернуть :
 *    res - документ(ы), которые нужно добавить, сгруппированные по таблицам
 *    reorder - массив узлов дерева, которые нужно сдвинуть при вставке  
 *   
 * @param {*} body 
 * 
 * {"method": "insert", "type": "tree", "id": "dev",
 *  "parentnode":"SensorD", // Обязательно, если нет - ошибка
 *  "prevnode":"t210", // Если нет или отсутствует - в конец?
    "payload": {
    "types": { // это имя поддерева 
      "nodes":[{"title":"New node", <popupid:"t210">}]
   }}}

 *  {"method": "insert", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 *  "parentnode":"folder1", // Не обязательно, если нет - в верхний уровень
 *  "prevnode":"ch_0", // Если нет или отсутствует - в конец?
    "payload": [{popupid:<'node'|'folder'>}]
   }
 *
 * @return {Object} - 
 *    {res:{<table>:{docs:[]}}
 *     reorder:[{id, order}]} 
 */
async function insert(body) {
  if (!body.payload) return;

  const parentid = body.parentid || 0;
  const previd = body.previd || 0;
  const payload = body.payload;
  const res = {};

  if (body.type == 'subtree') {
    updatecheck.checkSubtreeWithPayloadArray(body);
    const navnodeid = body.navnodeid;
    const desc = descriptor.getDescItem('tree', body.id);
    if (parentid) await checkParentExists(parentid, desc);

    const treeObj = await dataformer.getCachedSubTree(body.id, navnodeid);

    await ordering.exec({ payloadItem: payload, treeObj: { children: treeObj }, treeDesc: desc, parentid, previd });

    const newDocs = payload.map(item => Object.assign(item, { folder: item.popupid == 'folder' ? 1 : 0, navnodeid }));

    res[desc.branch.table] = {
      docs: await createNewDocs(newDocs, desc.branch.table, parentid)
    };
  } else {
    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      await checkParentExists(parentid, desc, 'nolost');

      const treeObj = await dataformer.getCachedTree(rootid);

      await ordering.exec({ payloadItem: payload[rootid], treeObj, treeDesc: desc, parentid, previd });

      if (payload[rootid].folders && payload[rootid].folders.length) {
        res[desc.branch.table] = { docs: await createNewDocs(payload[rootid].folders, desc.branch.table, parentid) };
      }
      if (payload[rootid].nodes && payload[rootid].nodes.length) {
        res[desc.leaf.table] = { docs: await createNewDocs(payload[rootid].nodes, desc.leaf.table, parentid) };
      }
    }
  }
  return { res };
}

async function checkParentExists(parentid, desc, nolost) {
  if (nolost) updatecheck.checkIsNodeLostFolder(parentid);
  const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
  await updatecheck.checkOneRecordExists(parentCollection, parentid);
}

async function createNewDocs(nodes, table, parentid) {
  if (!nodes || !table) return [];

  const docs = [];
  const tdesc = descriptor.getDescItem('table', table);
  const defRec = descriptor.getTableDefaultRecord(table);
  if (defRec) {
    for (const item of nodes) {
      const _id = numerator.getNewId(table);
      docs.push(Object.assign({ _id, parent: parentid, order: item.order }, tdesc.filter, defRec));
    }
  } else {
    for (const item of nodes) {
      const doc = await createOneRecord(table, tdesc, item, parentid);
      if (doc) docs.push(doc);
    }
  }
  return docs;
}

async function createOneRecord(table, tdesc, item, parentid) {
  const _id = numerator.getNewId(table);
  const doc = Object.assign({ _id, parent: parentid, order: item.order }, tdesc.filter);
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

      doc.unit = item.navnodeid;
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
    "parentid":"ActorD", // целевая папка, куда нужно копировать
    "previd":'t001', // Точка вставки  (после этого узла) Если нет - копировать в конец
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
  const payload = body.payload;
  const targetid = body.parentid || 0;
  const previd = body.previd || 0; // Может придти null - null это объект!!

  let seqObj;
  if (body.type == 'subtree') {
    const nodeid = body.navnodeid;
    if (!nodeid) throw { message: 'Expected navnodeid!' };

    const desc = descriptor.getDescItem('tree', body.id);
    const treeObj = await dataformer.getCachedSubTree(body.id, nodeid);

    // Рассчитать order для новых узлов. Определить, нужно ли сдвигать (shifted)
    const result = await ordering.exec({
      payloadItem: payload,
      treeObj: { children: treeObj },
      treeDesc: desc,
      parentid: targetid,
      previd,
      seq: payload.seq
    });
    console.log('RESULT='+util.inspect(result));
    seqObj = result.seqObj;
    await docsToCopy({ children: treeObj }, payload, desc);
  } else {
    if (!targetid) throw { err: 'SOFTERR', message: 'Expected "parentid" as target folder id!' };

    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      const treeObj = await dataformer.getCachedTree(rootid);

      // Рассчитать order для новых узлов. Определить, нужно ли сдвигать (shifted)
      const result = await ordering.exec({
        payloadItem: payload[rootid],
        treeObj,
        treeDesc: desc,
        parentid: targetid,
        previd,
        seq: payload[rootid].seq
      });
      // Новые order будут присвоены тут

      seqObj = result.seqObj;
      console.log('RESULT=' + util.inspect(seqObj));
      await docsToCopy(treeObj, payload[rootid], desc);
    }
  }
  return { res };

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
  doc.order = seqObj && seqObj[doc._id] ? seqObj[doc._id] : doc.order;
  doc._id = numerator.getNewId(table);
  doc.parent = target;
  if (table == 'devhard') {
    doc.chan += '_COPY';
  } else doc.name += ' (copy)'; // name+copy
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
 * {"method": "update", "type": "tree", "id": "dev",
    "parentid":"SensorA",
    "previd":"t210"
    "payload": {
      "types": { // это имя поддерева
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"}]  
      }
    }
   }

 * {"method": "update", "type": "subtree", "id": "channels", "navnodeid":"modbus1",
 *  "parentnode":"folder1", // Не обязательно, если нет - в верхний уровень
 *  "prevnode":"ch_0", // Если нет или отсутствует - в конец?
    "payload": [{"nodeid":"ch_142"}]
   }
 *
 * @return {Object} - 
 *    {res:{<table>:{docs:[]}}
 *     reorder:[{id, order}]} 
 */
async function update(body) {
  if (!body.payload) return;

  const parentid = body.parentid || 0;
  const previd = body.previd || 0;
  const payload = body.payload;
  const res = {};

  if (body.type == 'subtree') {
    updatecheck.checkSubtreeWithPayloadArray(body);
    const navnodeid = body.navnodeid;
    const desc = descriptor.getDescItem('tree', body.id);
    if (parentid) await checkParentExists(parentid, desc);

    if (payload.length) {
      const treeObj = await dataformer.getCachedSubTree(body.id, navnodeid);

      // Дерево без корня, treeObj - массив, поэтому смоделировать верхний уровень
      const { shifted } = await ordering.exec({
        payloadItem: payload,
        treeObj: { children: treeObj },
        treeDesc: desc,
        parentid,
        previd
      });

      await formRes(payload, desc.branch.table, parentid);
    }
  } else {
    for (const rootid in payload) {
      const desc = descriptor.getDescItem('tree', rootid);
      await checkParentExists(parentid, desc, 'nolost');

      const treeObj = await dataformer.getCachedTree(rootid);

      const { shifted } = await ordering.exec({
        payloadItem: payload[rootid],
        treeObj,
        treeDesc: desc,
        parentid,
        previd
      });

      if (payload[rootid].folders) {
        await formRes(payload[rootid].folders, desc.branch.table, parentid);
      }
      if (payload[rootid].nodes) {
        await formRes(payload[rootid].nodes, desc.leaf.table, parentid);
      }
    }
  }
  return { res };

  async function formRes(nodes, table, parent) {
    try {
      const tdesc = descriptor.getDescItem('table', table);
      res[table] = { docs: [] };

      for (const item of nodes) {
        console.log(' item ' + util.inspect(item));
        const _id = item.nodeid;
        if (!_id) continue;

        const doc = prepareDocForSet(item, parent);
        if (!doc) continue;

        // Проверить, что перемещаемая запись существует и это не корневая папка??
        const olddoc = await dbstore.findOne(tdesc.collection, { _id });
        if (!olddoc) throw new Error('Not found doc: _id = ' + _id + ', collection ' + tdesc.collection);
        // if (!olddoc.parent) throw new Error(appconfig.getMessage('FolderRootOrNotFound'));

        res[table].docs.push(Object.assign(olddoc, { $set: doc }));
      }
    } catch (e) {
      throw new Error('Update error: ' + util.inspect(e));
    }
  }
}

function prepareDocForSet(item, parent) {
  const res = {};
  if (item.order) res.order = item.order;
  if (parent) res.parent = parent;
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
    "type": "subtree",
    "id": "channels",
    "navnodeid": "modbus1",
    "payload": { 
        "folders":[{"nodeid":"folder1"}],
        "nodes":[{"nodeid":"ch_xx"}]  
    }
   }
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
