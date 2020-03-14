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
  const res = []; // массив изменений вернем

  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid); // rootid - имя дерева

    // Внутри м б folders || nodes (или одновременно??)
    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
    if (payload[rootid].folders) {
      await updateNodes(rootid, payload[rootid].folders, desc.branch.table, parentCollection);
    }
    if (payload[rootid].nodes) {
      await updateNodes(rootid, payload[rootid].nodes, desc.leaf.table, parentCollection);
    }
  }
  return res;

  async function updateNodes(treeId, nodes, table, parentCollection) {
    const tdesc = descriptor.getDescItem('table', table);

    for (const item of nodes) {
      const doc = prepareTreeRecordForUpdate(item);
      if (item.nodeid && doc) {
        // Если перемещение в другую папку - проверить, что папка существует
        if (doc.parent) await checkParent([doc], parentCollection, 'nolost');

        // Проверить, что перемещаемая запись существует и это не корневая папка
        // В случае неудачи - не удалось выполнить операцию
        const guideItem = treeguide.getItem(treeId, item.nodeid);
        if (!guideItem) throw { error: 'ERR', message: appconfig.getMessage('FolderRootOrNotFound') };
        if (!guideItem.parent) throw { error: 'ERR', message: appconfig.getMessage('FolderRootOrNotFound') };

        // Папку lost+found нельзя перемещать!
        if (isNodeLostFolder(item.nodeid)) throw { error: 'ERR', message: appconfig.getMessage('FolderLostInvOper') };

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

/**  copyTo
 *  Копировать узел (узлы?) (лист или папку) в дереве. Если папка - копируется все содержимое
 *  Приходит nodeid копируемого объекта и order
 *  - Создать новые узлы как копии, генерировать новые id, записать в таблицу
 *  - Вернуть массив добавленных узлов в формате дерева (поддерево)
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
async function copyTo(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const targetid = body.nodeid;
  if (!targetid) throw { err: 'SORTERR', message: 'Expected node as target id!' };

  const res = []; // Массив изменений для treeguide
  const seqObj = {};
  const reorder = {};

  const targetorder = body.order;
  let l_array = [];
  const b_array = [];

  // Копировать можно только из одного дерева
  if (Object.keys(payload).length > 1) throw { err: 'ERR', message: appconfig.getMessage('OnlyOneRootForCopy') };

  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid);
    const tree = await dataformer.get('tree', rootid); // Все дерево с одним корнем
    const treeObj = tree.data[0];

    // рассчитать новые order для узлов
    const subtree = treeutil.findNodeById(treeObj, targetid); // Поддерево, куда копируем
    await formOrders(subtree, payload[rootid].seq, desc);

    // простые листья
    if (payload[rootid].nodes) {
      const docs = await copyNodes(payload[rootid].nodes, desc.leaf.table, targetid);
      l_array = docs.map(doc => formArrayItem(doc));
    }

    // Папки - копировать все содержимое включая подпапки
    // Для каждой папки создавать вложенные элементы (подпапки и листья как точную копию, отличается только parent)
    if (payload[rootid].folders) {
      for (let i = 0; i < payload[rootid].folders.length; i++) {
        const folder = payload[rootid].folders[i];
        const branchObj = treeutil.findNodeById(treeObj, folder.nodeid); // Получить поддерево узла, который копируем
        await copyWithChildren(branchObj, desc.branch.table, desc.leaf.table, targetid);
      }
    }
  }

  // Вернуть вставленное поддерево и reorder
  const result = { res, data: treeutil.makeTreeWithLeaves(b_array, l_array) };
  if (!hut.isObjIdle(reorder)) result.reorder = reorder;
  return result;

  async function formOrders(targetObj, seq, desc) {
    // targetObj - поддерево узла, в который копируем
    if (!targetObj) throw { err: 'ERR', message: 'Not found target node:' + targetid };
    if (!targetObj.children) throw { err: 'ERR', message: 'Not allowed leaf as target node: ' + targetid };
    if (!seq || !Array.isArray(seq)) throw { err: 'ERR', message: 'Expected seq for copypaste method!' };

    // В массиве children найти элемент с order >= targetorder
    let targetIdx;
    let startOrder = 1000;
    let delta = 1000;
    let needReorderIdx;
    if (targetObj.children.length) {
      // иначе вставляем в пустую папку - все по def

      // Если order определен - ищем его в массиве, иначе в конец
      targetIdx = targetorder
        ? targetObj.children.findIndex(item => item.order >= targetorder)
        : targetObj.children.length - 1;

      if (targetIdx < 0) {
        // не нашли в массиве - в конец
        targetIdx = targetObj.children.length - 1;
      }

      startOrder = targetObj.children[targetIdx].order;

      if (targetIdx < targetObj.children.length - 1) {
        // Берем найденный order и следующий и считаем интервал, в который можем вставить
        const interval = targetObj.children[targetIdx + 1].order - startOrder;
        delta = Math.round(interval / (seq.length + 1));

        if (delta < 2) {
          delta = 1000; // Просто добавляем каждому элементу по 1000
          needReorderIdx = targetIdx + 1;
        }
      }
    }

    // нумерация для копируемых узлов
    let nextOrder;
    seq.forEach((el, idx) => {
      nextOrder = startOrder + delta * (idx + 1);
      seqObj[el] = nextOrder;
    });

    // return needReorderIdx; // вставляем после, поэтому 0 - значит нет

    // Если не смогли поместиться - нужно будет перенумеровать все элементы после targetIdx ???
    // Записать в таблицу и отправить в ответе

    if (needReorderIdx) {
      const l_arr = [];
      const b_arr = [];
      for (let i = targetIdx + 1; i < targetObj.children.length; i++) {
        const item = targetObj.children[i];
        const id = item.id;
        nextOrder += 1000;
        reorder[id] = nextOrder; // для того чтобы отдать в response

        if (item.children) {
          b_arr.push({ nodeid: id, order: nextOrder });
        } else {
          l_arr.push({ nodeid: id, order: nextOrder });
        }
      }

      if (l_arr.length) await updateNodeOrders(l_arr, desc.leaf.table); // таблицы разные!!
      if (b_arr.length) await updateNodeOrders(b_arr, desc.branch.table);
    }
  }

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

// Изменяется только order
// nodes:[{nodeid, order}]
async function updateNodeOrders(nodes, table) {
  const tdesc = descriptor.getDescItem('table', table);

  for (const item of nodes) {
    const doc = prepareTreeRecordForUpdate(item);
    if (item.nodeid && doc) {
      await dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: doc });
    }
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
  for (const rootid in payload) {
    // Это имя поддерева
    const desc = descriptor.getDescItem('tree', rootid);
    const parentCollection = descriptor.getDescItem('table', desc.branch.table).collection;
    // Внутри м б folders || nodes (или одновременно??)
    await processNodes(payload[rootid].folders, desc.branch.table, parentCollection, desc.branch.propremap, 'folder');
    await processNodes(payload[rootid].nodes, desc.leaf.table, parentCollection, desc.leaf.propremap);
  }
  return data;

  async function processNodes(nodes, table, parentCollection, propremap, folder) {
    if (nodes) {
      const docs = [];
      const tdesc = descriptor.getDescItem('table', table);
      const defRec = descriptor.getTableDefaultRecord(table);

      // Сформировать новые папки
      nodes.forEach(item => {
        const res = createOneTreeRecord(table, tdesc, item, defRec);
        if (res) docs.push(res);
      });

      // Проверить, что parent папки существуют
      await checkParent(docs, parentCollection, 'nolost');

      await dbstore.insert(tdesc.collection, docs);

      // На выход нужно title, order, id, children - нужно мапить
      docs.forEach(doc => {
        data.push(formOneTreeItem(doc, propremap, folder));
      });
    }
  }
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
 * Проверка, что записи parent существуют
 * @param {Array of Object} docs
 * @param {string} collection
 * @param {string || Bool} nolost
 *
 * throw при ошибке
 */
async function checkParent(docs, collection, nolost) {
  const parentSet = new Set();
  docs.forEach(doc => {
    if (!doc.parent) throw { error: 'SOFTERR', message: 'Expected parent prop!' };
    if (nolost && isNodeLostFolder(doc.parent))
      throw { error: 'ERR', message: appconfig.getMessage('FolderLostInvOper') };

    parentSet.add(doc.parent);
  });
  if (!parentSet.size) return;

  // Проверить, что parents есть в таблице
  // filter сформировать как in, если записей несколько
  const arr = Array.from(parentSet);
  const filter = arr.length > 1 ? datautil.createIdsInFilter(arr) : { _id: arr[0] };
  await checkRecordsExist(collection, filter, parentSet);
}

function isNodeLostFolder(node) {
  return node && node.substr(0, 5) == 'lost_';
}

async function checkRecordsExist(collection, filter, idSet) {
  const result = await dbstore.get(collection, filter);

  // Не найдена ни одна запись
  if (!result) {
    throw {
      error: 'ERRNOTFOUND',
      message: `Record not exists! Not found with filter:${JSON.stringify(filter)} in collection:${collection}`
    };
  }

  // Не найдена одна (несколько) из
  if (result.length != idSet.size) {
    // Найти, каких нет
    result.forEach(record => {
      if (idSet.has(record._id)) idSet.delete(record._id);
    });

    throw {
      error: 'ERRNOTFOUND',
      message: `Record not exists! Not found record with _id:${Array.from(idSet).join(',')} in collection:${collection}`
    };
  }
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
 *
 */

async function remove(body) {
  const payload = body.payload;
  const notRemoved = [];
  const removed = [];

  for (const rootid in payload) {
    const tree = await getCachedTree(rootid);

    // Внутри м б folders || nodes (или одновременно)
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

/*
async function remove(body) {
  const payload = body.payload;
  const notRemoved = [];
  let removed;

  for (const rootid in payload) {
    // Это имя дерева
    const desc = descriptor.getDescItem('tree', rootid);
    const tree = await getCachedTree(rootid);

    // Внутри м б folders || nodes (или одновременно??)
    const leavesToDelete = [];
    if (payload[rootid].nodes) {
      const tdesc = descriptor.getDescItem('table', desc.leaf.table);

      for (const item of payload[rootid].nodes) {
        if (item.nodeid) leavesToDelete.push(item.nodeid);
      }
      // Удалить все листья
      await removeItems(leavesToDelete, tdesc.collection);
    }
    const arr = [];
    if (payload[rootid].folders) {
      const tdesc = descriptor.getDescItem('table', desc.branch.table);

      for (const item of payload[rootid].folders) {
        if (item.nodeid && !isNodeLostFolder(item.nodeid)) {
          if (isBranchEmpty(tree, item.nodeid, leavesToDelete)) {
            arr.push(item.nodeid);
          } else {
            notRemoved.push(item.nodeid);
          }
        }
      }

      if (arr.length) {
        await removeItems(arr, tdesc.collection);
      }
    }
    removed = leavesToDelete.concat(arr);
  }

  return { removed: removed ? removed.map(el => ({ id: el })) : [], notRemoved };
}
*/

function isBranchEmpty(tree, branchid, leavesDeleted) {
  const deletedSet = new Set(leavesDeleted);

  const { l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, branchid);
  // Если узлы были удалены - они в deletedSe
  // Также могут быть вложенные папки b_arr - их проверять не надо, они удаляются, если удалена основная
  if (l_arr && l_arr.length) {
    for (const el of l_arr) {
      if (!deletedSet.has(el)) return false;
    }
  }
  return true;
}

async function getCachedTree(treeId) {
  const key = descriptor.getCacheKey('tree', treeId);

  const cachedObj = await dataformer.getTree(treeId); // {data, ts}
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached Obj for key=' + key };

  return cachedObj.data[0]; // Это массив, берем первый корень
}

async function removeItems(arr, collection) {
  const filter = datautil.createIdsInFilter(arr);
  return dbstore.remove(collection, filter, { multi: arr.length > 1 });
}

module.exports = {
  insert,
  update,
  remove,
  copyTo
};

/*

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
