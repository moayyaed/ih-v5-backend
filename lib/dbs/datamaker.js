/**
 * datamaker.js
 *
 * Выполняет операции создания, копирования, проверки удаления на прикладном уровне
 */

// const util = require('util');

const dbstore = require('./dbstore');
const datautil = require('./datautil');
const numerator = require('./numerator');
const descriptor = require('./descriptor');
const typestore = require('../dbs/typestore');


async function createNewDocsFromTree(nodes, table, parentid) {
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
      return typestore.createDeviceDoc(doc, item.popupid);

    case 'devhard':
      // Сформировать запись для канала
      doc.unit = item.navnodeid;
      if (item.folder) {
        doc.folder = 1;
        doc.chan = 'New folder';
      } else {
        doc.chan = 'New channel';
      }
      return doc;

    default:
  }
}

async function copyDocsFromTree(nodes, table, target, seqObj) {
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

async function copyOneFromTree(node, table, target, seqObj) {
  const tdesc = descriptor.getDescItem('table', table);
  const doc = await dbstore.findOne(tdesc.collection, { _id: node.id });
  if (doc) copypasteDoc(table, doc, target, seqObj);
  return doc;
}

function copypasteDoc(table, doc, target, seqObj) {
  doc.order = seqObj && seqObj[doc._id] ? seqObj[doc._id] : doc.order;
  doc._id = numerator.getNewId(table);
  doc.parent = target;
  switch (table) {
    case 'devhard':
      doc.chan += '_COPY';
      break;
    case 'device':
      doc.name += ' (copy)'; // name+copy

      doc.dn = typestore.getNewDnAsCopy(doc.dn);
      break;
    default:
      doc.name += ' (copy)'; // name+copy
  }
}

async function checkDocCanBeRemoved(table, doc) {
  let items;
  switch (table) {
    case 'type':
      items = await dbstore.get('devices', {type:doc._id}, {fields: {dn:1, type:1} });
      if (items.length) {
        throw {err:'ERR', message:'Удаление не выполнено! Найдено устройств типа '+doc.name+': '+items.length}
      }
      break;

    case 'device':
      break;
    default:
      
  }
}

module.exports = {
  createNewDocsFromTree,
  createOneRecord,
  copyDocsFromTree,
  copyOneFromTree,
  checkDocCanBeRemoved
};
