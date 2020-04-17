/**
 * dbs/init.js - инициализация структур работы с данными
 */

const util = require('util');


const dm = require('../datamanager');
const descriptor = require('../descriptor');

const typestore = require('./typestore');
const liststore = require('./liststore');
const tagstore = require('../api/tagstore');
const treeguide = require('../api/treeguide');

const collectionsWithTags = ['devices', 'types'];

module.exports = async function() {
  const dbstore = dm.dbstore;
  
  liststore.start(dm);
  const listNames = descriptor.getListNames();
  for (const id of listNames) {
    await liststore.loadList(id);
  }
  
  // загрузка данных в typestore - типы и префиксы device
  const typeDocs = await dbstore.get('types', {}, {});
  const deviceDocs = await dbstore.get('devices', {}, { fields: { dn: 1 }, order: 'dn' });
  typestore.start(typeDocs, deviceDocs);

  // Создать tagstore, из некоторых коллекций считать тэги
  tagstore.start();
  for (const collection of collectionsWithTags) {
    const docs = await dbstore.get(collection, { tags: { $exists: true } }, { fields: { tags: 1 } });
    tagstore.addFromDocs(docs, collection);
  }
 
  treeguide.start();
};
