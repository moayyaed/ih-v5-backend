/**
 * datamaker.js
 * 
 * Создание записей 
 */

const util = require('util');

const devicemanager = require('../devices/devicemanager');
const numerator = require('./numerator');
const descriptor = require('./descriptor');

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

module.exports = {
  createNewDocsFromTree,
  createOneRecord
}