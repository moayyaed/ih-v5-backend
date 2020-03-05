/**
 * updater.js
 */

const util = require('util');
const shortid = require('shortid');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const treeutil = require('../utils/treeutil');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');
const dataformer = require('./dataformer');
const cache = require('./cache');
const datautil = require('./datautil');

/**
 * Сформировать вспомогательный объект для разбора формы и сохранить в кэш
 * @param {String} id - ид-р формы
 * @return {Object} Объект для разбора формы:
 * {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     }
   }
 */
async function getMetaUpForm(id) {
  const metaData = await dataformer.getMeta('form', id);
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];
  const alloc = {}; // table->prop->cell

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (cell.table) {
      records.push({ cell: cell.id, table: cell.table });
      addAlloc(cell.table, formMetaData[cell.id], cell.id);
    }

    // может быть компонент-таблица
    if (formMetaData[cell.id]) {
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: cell.table, prop: item.prop });
          addAlloc(item.prop, item.columns, cell.id);
        }
      });
    }
  }

  // Сохранить в кэш
  const key = descriptor.getCacheKey('upform', id, 'meta');
  cache.set(key, { records, tables, alloc });
  return cache.get(key).data;

  function addAlloc(table, arr, cellid) {
    if (!alloc[table]) alloc[table] = {};

    arr.forEach(item => {
      if (item.type != 'table') {
        alloc[table][item.prop] = cellid;
      }
    });
  }
}

// Перемещение - изменяется order и parentid
async function updateTree(body) {
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

async function copyToTree(body) {
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
async function insertTree(body) {
  if (!body.payload) return;

  const payload = body.payload;

  const data = [];
  for (const rootid in payload) {
    // Это имя поддерева
    const desc = descriptor.getDescItem('tree', rootid);
    const parentCollection = descriptor.getDescItem('table',desc.branch.table).collection;
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
      if (!doc.parent) throw { error: 'ERR', message:'Expected parent prop!' };
      if (nolost && doc.parent.substr(0,5) == 'lost_') throw { error: 'ERR', message:'invalid operation for folder "lost"!' };

      parentSet.add(doc.parent);
  });
  if (!parentSet.size) return;

  // Проверить, что parents есть в таблице
  // filter сформировать как in, если записей несколько
  const arr = Array.from(parentSet);
  const filter = arr.length > 1 ? datautil.createIdsInFilter(arr) : {_id:arr[0]};
  await checkRecordsExist(collection, filter, parentSet);
}

async function checkRecordsExist(collection, filter, idSet) {
  console.log('Before dbstore.get '+collection+' '+util.inspect(filter));
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


async function removeFromTree(body) {
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

  const { b_arr, l_arr } = treeutil.gatherBranchsAndLeavesIdsForBranch(tree, branchid);
  // Если узлы были удалены - они в deletedSe
  // Также могут быть вложенные папки - их проверять не надо, они удаляются, если удалена основная
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

/*
  const desc = descriptor.getDescItem('tree', id);
  const branchOrLeaf = body.options && body.options.leaf ? 'leaf' : 'branch';
  const table = desc[branchOrLeaf] && desc[branchOrLeaf].table ? desc[branchOrLeaf].table : '';
  if (!table) throw { error: 'SOFTERR', message: `No table prop for tree ${branchOrLeaf} ${body.id}` };

  docsToWrite = hut.mapProps(data, desc[branchOrLeaf].propremap);
  keysToClear = this.cacheInvalidateList[table];

  desc = descriptor.getDescItem('table', table);
  */

/**
 * Сохранение данных формы. На форме могут быть данные из нескольких таблиц
 *
 * @param {Object} body
 *       id - идентификатор формы
 *   nodeid - идентификатор данных (узел, из которого вызывана форма)
 *  payload - объект содержит измененные данные формы
 *
 */
async function updateForm(body, insert) {
  const { id, nodeid, payload } = body;
  const data = [];

  let formMetaDataForUpdate;
  const key = descriptor.getCacheKey('upform', id, 'meta');
  if (cache.has(key)) {
    formMetaDataForUpdate = cache.get(key).data;
  } else {
    formMetaDataForUpdate = await getMetaUpForm(id);
  }

  console.log('formMetaDataForUpdate = ' + util.inspect(formMetaDataForUpdate));

  const docsToWrite = {};
  const tablesToWrite = {};
  const changedTables = [];

  formMetaDataForUpdate.records.forEach(item => {
    if (payload[item.cell]) {
      if (!docsToWrite[item.table]) docsToWrite[item.table] = { _id: nodeid };
      // Добавить плоские значения
      Object.keys(payload[item.cell]).forEach(field => {
        if (typeof payload[item.cell][field] != 'object') {
          docsToWrite[item.table][field] = payload[item.cell][field];
        }
      });
    }
  });

  formMetaDataForUpdate.tables.forEach(item => {
    if (payload[item.cell] && payload[item.cell][item.prop] && typeof payload[item.cell][item.prop] == 'object') {
      // Добавить табличные значения компонент-таблиц
      tablesToWrite[item.table] = payload[item.cell][item.prop];
    }
  });

  console.log('docsToWrite ' + util.inspect(docsToWrite));
  console.log('tablesToWrite ' + util.inspect(tablesToWrite));

  // Сначала проверить, что записи существуют! И выполнить валидацию данных

  // Так как откатить не сможем и ответ должен быть один!!
  validateForm(formMetaDataForUpdate, docsToWrite, tablesToWrite);

  // Запись records
  try {
    for (const table in docsToWrite) {
      const doc = docsToWrite[table];
      const filter = { _id: doc._id };
      delete doc._id;
      const desc = descriptor.getTableDesc(table);
      if (insert) {
        // Табличку добавить здесь же??
        doc._id = body.nodeid;
        doc.parent = body.parentid || 0;
        doc.order = body.order || 0;

        if (desc.filter) {
          hut.extend(doc, desc.filter);
        }
        await dbstore.insert(desc.collection, doc);
      } else {
        await dbstore.update(desc.collection, filter, { $set: doc });
      }

      // TODO здесь нужно title формировать по разному??
      if (doc.name) {
        data.push({ id: body.nodeid, title: doc.name });
      }

      changedTables.push(table);
    }
  } catch (e) {
    throw new Error('Update error ' + util.inspect(e));
  }

  // Запись таблиц отдельно, если update
  if (!insert) {
    try {
      for (const table in tablesToWrite) {
        const docToWrite = tablesToWrite[table];
        const filter = { _id: nodeid };
        const desc = descriptor.getTableDesc(table);
        const setObj = makeSetObj(docToWrite, desc.genfield);

        const unsetObj = makeUnsetObj(docToWrite, desc.genfield);
        if (setObj || unsetObj) {
          const setUnset = {};
          if (setObj) setUnset.$set = setObj;
          if (unsetObj) setUnset.$unset = unsetObj;
          await dbstore.update(desc.collection, filter, setUnset);
        }
      }
    } catch (e) {
      throw new Error('Update error ' + util.inspect(e));
    }
  }
  // Вернуть список таблиц измененных? НЕТ, нужно вернуть запись для дерева: {id, title}
  return data.length ? data : '';
}

function makeSetObj(data, genfield) {
  let setObj;
  // data = { value:{ max: 42, min: 17 }, _newkey:{min:0, max:100}} // Нужно добавить новый ключ!!
  for (const mainprop in data) {
    if (typeof data[mainprop] == 'object') {
      for (const prop in data[mainprop]) {
        if (!setObj) setObj = {};
        setObj[genfield + '.' + mainprop + '.' + prop] = data[mainprop][prop];
      }
    }
  }
  return setObj;
}

function makeUnsetObj(data, genfield) {
  let unsetObj;
  // data = { value:{ max: 42, min: 17 }, oldprop:'' // Удаление, если не объект
  for (const mainprop in data) {
    if (!data[mainprop]) {
      if (!unsetObj) unsetObj = {};
      unsetObj[genfield + '.' + mainprop] = 1;
    }
  }
  return unsetObj;
}

function validateForm(formMetaDataForUpdate, docsToWrite, tablesToWrite) {
  const errdata = {};
  // Проверка records
  for (const table in docsToWrite) {
    const doc = docsToWrite[table];
    const valObj = descriptor.getTableValidator(table);
    if (valObj && valObj.main) {
      Object.keys(doc).forEach(prop => {
        if (valObj.main[prop]) {
          const errTxt = checkProp(valObj.main[prop], prop, doc[prop]);
          if (errTxt) addErrdata(table, prop, errTxt);
        }
      });
    }
  }

  // Проверка таблиц
  for (const table in tablesToWrite) {
    const data = tablesToWrite[table]; // Это объекты для каждой строки

    // const desc = descriptor.getTableDesc(table);
    // const valObj = desc.validator && desc.validator.props ? desc.validator.props : '';

    // ЗАГЛУШКА! нужны правила валидации
    let newRec;
    for (const mainprop in data) {
      if (typeof data[mainprop] == 'object') {
        if (mainprop.substr(0, 1) == '__') {
          // Временный ключ начинается с двойного подчеркивания
          // Это новая запись - создать новый id = prop  - НУЖНЫ ПРАВИЛА!!
          const newkey = data[mainprop].prop;
          if (!newkey) {
            throw {
              error: 'Validation',
              data: { p3: { [table]: [{ id: mainprop, prop: 'Это поле не может быть пустым!' }] } }
            };
          }
          // скопировать объект с новым ключом, временные удалить после цикла
          data[newkey] = hut.clone(data[mainprop]);
          if (!newRec) newRec = [];
          newRec.push(mainprop);
        }

        /**  Проверка таблицы по правилам валидации 
        for (const prop in data[mainprop]) {
          if (valObj && valObj[prop]) {
            const errTxt = checkProp(valObj[prop], prop, data[mainprop][prop]);
            if (errTxt) addErrTabdata(table, mainprop, prop, errTxt);
          }
        }
        */
      }
    }
    if (newRec)
      newRec.forEach(mainprop => {
        delete data[mainprop];
      });
  }
  // Результат проверки
  if (!hut.isObjIdle(errdata))
    throw { error: 'Validation', message: appconfig.getMessage('FailUpdate'), data: errdata };

  function addErrdata(table, prop, text) {
    const cellid = formMetaDataForUpdate.alloc[table][prop];
    if (!errdata[cellid]) errdata[cellid] = {};
    errdata[cellid][prop] = text;
  }

  //  { p3: { [table]: { [mainprop]: { [prop]: 'Отрицательное значение :' + val } } } }
  function addErrTabdata(table, mainprop, prop, text) {
    const cellid = formMetaDataForUpdate.alloc[table][prop];
    if (!errdata[cellid]) errdata[cellid] = {};
    if (!errdata[cellid][table]) errdata[cellid][table] = {};
    if (!errdata[cellid][table][mainprop]) errdata[cellid][table][mainprop] = {};
    errdata[cellid][table][mainprop][prop] = text;
  }
}

function checkProp(rule, prop, value) {
  if (!rule.empty && !value) return rule.description;
}

module.exports = {
  updateForm,
  insertTree,
  updateTree,
  removeFromTree,
  copyToTree,
  makeSetObj // for test
};

/*
{
  "method":"update",
  "type":"form",
  "id":"formTypeCommon",
  "nodeid":"t200",
  "payload":{"p1":{"name":"My new record"},"p3":{"typepropsTable":{"value":{ "max":40}, "setpoint":{"min":-2, "vtype":"N", "op":"rw"}}}}
}
*/
