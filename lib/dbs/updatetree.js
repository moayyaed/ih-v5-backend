/**
 * updater.js
 */

const util = require('util');
const shortid = require('shortid');

const hut = require('../utils/hut');
const treeutil = require('../utils/treeutil');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const cache = require('./cache');
const datautil = require('./datautil');

// Перемещение - изменяется order и parentid
async function update(body) {
  if (!body.payload) return;

  const payload = body.payload;

  for (const rootid in payload) {
    // Это имя дерева
    const desc = descriptor.getDescItem('tree', rootid);

    // Внутри м б folders || nodes (или одновременно??)

    if (payload[rootid].folders) {
      const tdesc = descriptor.getDescItem('table', desc.branch.table);
      // Изменить папки
      for (const item of payload[rootid].folders) {
        const doc = prepareTreeRecordForUpdate(item);
        if (item.nodeid && doc) {
          await dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: doc });
        }
      }
    }

    if (payload[rootid].nodes) {
      const tdesc = descriptor.getDescItem('table', desc.leaf.table);
      // Изменить записи
      for (const item of payload[rootid].nodes) {
        const doc = prepareTreeRecordForUpdate(item);
        if (item.nodeid && doc) {
          await dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: doc });
        }
      }
    }
  }
}

function prepareTreeRecordForUpdate(item) {
  const res = {};
  if (item.order) res.order = item.order;
  if (item.parentid) res.parent = item.parentid;
  return hut.isObjIdle(res) ? '' : res;
}

async function copyTo(body) {
  if (!body.payload) return;

  const payload = body.payload;
  const targetid = body.nodeid;

  const data = [];
  for (const rootid in payload) {
    // Это имя дерева
    const desc = descriptor.getDescItem('tree', rootid);

    // Внутри м б folders || nodes (или одновременно??)
    if (payload[rootid].nodes) {
      const tdesc = descriptor.getDescItem('table', desc.leaf.table);

      // Считать записи, заменить parent на targetid, также нужен новый order и в название добавить (copy)
      // Вернуть нужно будет вставленное поддерево

      const arr = payload[rootid].nodes.map(item => item.nodeid);
      const filter = datautil.createIdsInFilter(arr);
      const docs = await dbstore.get(tdesc.collection, filter);

      if (docs.length > 0) {
        docs.forEach(doc => {
          doc._id = shortid.generate(); // Новый id

          doc.parent = targetid; // Новый parent
          // Новый order??
          doc.name += ' (copy)'; // name+copy
        });
        await dbstore.insert(tdesc.collection, docs);

        docs.forEach(doc => {
          data.push(formOneTreeItem(doc, desc.leaf.propremap));
        });
      }
    }
  }
  return { data };
}

/**
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
  return { data };

  async function processNodes(nodes, table, parentCollection, propremap, folder) {
    if (nodes) {
      const docs = [];
      const tdesc = descriptor.getDescItem('table', table);
      const defRec = descriptor.getTableDefaultRecord(table);

      // Сформировать новые папки
      nodes.forEach(item => {
        const res = createOneTreeRecord(tdesc, item, defRec);
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
  ['id', 'title', 'order'].forEach(prop => {
    const rprop = propremap[prop];
    if (rprop && item[rprop] != undefined) res[prop] = item[rprop];
  });
  if (folder) res.children = [];
  return res;
}

function createOneTreeRecord(tdesc, item, defRec) {
  // item = {parentid, order}
  // TODO Нужен новый id - возможно, посчитать?
  const id = shortid.generate();

  // взять default запись
  const doc = Object.assign({ _id: id, parent: item.parentid, order: item.order }, tdesc.filter, defRec);
  return doc;
}

/**
 * Проверка, что записи parent существуют
 * @param {Object} doc
 * @param {Bool} needParent
 */
async function checkParent(docs, collection, nolost) {
  const parentSet = new Set();
  docs.forEach(doc => {
    if (!doc.parent) throw { error: 'ERR', message: 'Expected parent prop!' };
    if (nolost && doc.parent.substr(0, 5) == 'lost_')
      throw { error: 'ERR', message: 'invalid operation for folder "lost"!' };

    parentSet.add(doc.parent);
  });
  if (!parentSet.size) return;

  // Проверить, что parents есть в таблице
  // filter сформировать как in, если записей несколько
  const arr = Array.from(parentSet);
  const filter = arr.length > 1 ? datautil.createIdsInFilter(arr) : { _id: arr[0] };
  await checkRecordsExist(collection, filter, parentSet);
}

async function checkRecordsExist(collection, filter, idSet) {
  console.log('Before dbstore.get ' + collection + ' ' + util.inspect(filter));
  const result = await dbstore.get(collection, filter);

  // Не найдена ни одна запись
  if (!result) {
    throw {
      error: 'ERRNOPARENT',
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
      error: 'ERRNOPARENT',
      message: `Record not exists! Not found record with _id:${Array.from(idSet).join(',')} in collection:${collection}`
    };
  }
}

async function remove(body) {
  const payload = body.payload;
  const notRemoved = [];
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

    if (payload[rootid].folders) {
      const tdesc = descriptor.getDescItem('table', desc.branch.table);
      const arr = [];
      for (const item of payload[rootid].folders) {
        if (item.nodeid) {
          if (isBranchEmpty(tree, item.nodeid, leavesToDelete)) {
            arr.push(item.nodeid);
          } else {
            notRemoved.push(item.nodeid);
          }
        }
      }
      if (arr.length) await removeItems(arr, tdesc.collection);
    }
  }
  return notRemoved.length > 0 ? notRemoved : '';
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

  const cachedObj = cache.has(key) ? cache.get(key) : await dataformer.loadTree(treeId); // {data, ts}
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
