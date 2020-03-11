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
 * @return {Array}  массив изменений [{id, parent, order}]
 *
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

/**  copy
 *  Копировать узел (узлы?) (лист или папку) в дереве. Если папка - копируется все содержимое
 *  Приходит nodeid копируемого объекта и 
 *  - Создать новые узлы как копии, генерировать id, записать в таблицу
 *  - Вернуть массив добавленных узлов в формате дерева
 * 
 * @param {*} body 
 * 
 * {"method": "copy",
    "type": "tree",
    "id": "dev",
    "nodeid":"ActorD", // целевой узел, куда нужно копировать
    "payload": {
      "types": { // это имя поддерева
        "folders":[{"nodeid":"SensorD"}], // нужно скопировать папку и все ее содержимое 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}]  // плюс отдельные листья
      }
    }
   }
 * @return {Array}  массив изменений [{id, parent, order}]
 *
 */
async function copyTo(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const targetid = body.nodeid;

  const data = [];
  for (const rootid in payload) {
    const desc = descriptor.getDescItem('tree', rootid);

    // простые листья
    if (payload[rootid].nodes) {
      const docs = await copyNodes(payload[rootid].nodes, desc.leaf.table,targetid);
    }

    // Папки - нужно копировать все содержимое включая подпапки
    // Для каждой папки нужно создавать вложенные элементы (подпапки и листья как точную копию, отличается только parent)
   
    if (payload[rootid].folders) {
      const tree =  await dataformer.get("tree", rootid);   // Все дерево с одним корнем
      console.log('tree='+util.inspect(tree));
      const treeObj = tree.data[0];

       for (let i=0; i<payload[rootid].folders.length; i++) {
         const folder = payload[rootid].folders[i];
         const branchObj = treeutil.findNodeById(treeObj, folder.nodeid);  // Получить поддерево узла, который копируем
         await copyWithChildren(branchObj, desc.branch.table, desc.leaf.table, targetid);
       }
    }
  }
  
  // Вернуть нужно будет вставленное поддерево ?? Или массив новых узлов? Или всегда перегенерировать новое дерево?
  // Также нужно разрулить с order??
  return data;

  async function copyNodes(nodes, table, target) {
    const tdesc = descriptor.getDescItem('table', table);

    // Считать записи, заменить parent на targetid, в название добавить (copy)
    const arr = nodes.map(item => item.nodeid);
    const filter = datautil.createIdsInFilter(arr);
    const docs = await dbstore.get(tdesc.collection, filter);

    if (docs.length > 0) {
      docs.forEach(doc => {
        doc._id = numerator.getNewId(table);
        doc.parent = target; 

        // TODO Новый order?? Пока взять старый ордер
        doc.name += ' (copy)'; // name+copy
      });
      await dbstore.insert(tdesc.collection, docs);
    }
    return docs;
  }

  async function copyOne(node, table, target) {
    const tdesc = descriptor.getDescItem('table', table);

    // Считать записи, заменить parent на targetid, в название добавить (copy)
    const doc = await dbstore.findOne(tdesc.collection, {_id:node.id});

    if (doc) {
   
        doc._id = numerator.getNewId(table);
        doc.parent = target; 

        // TODO Новый order?? Пока взять старый ордер
        doc.name += ' (copy)'; // name+copy
    
      await dbstore.insert(tdesc.collection, [doc]);
    }
    return doc;
  }


  async function copyWithChildren(node, branchTable, leafTable, target) {
    // Этот узел и все вложенные, если есть children
    const table = node.children ? branchTable : leafTable;
    const newDoc = await copyOne(node, table, target);

    if (!node.children || !node.children.length) return; // Это лист или пустая папка

    for (const child of node.children)  {
      await copyWithChildren(child, branchTable, leafTable, newDoc._id);
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
      "nodes":[{"parentid":"SensorD", "order":75}]
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
