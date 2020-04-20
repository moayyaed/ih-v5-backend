/**
 * dbs/init.js - инициализация структур работы с данными
 */

// const util = require('util');


const dm = require('../datamanager');
const descriptor = require('../descriptor');

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

  // Создать tagstore, из некоторых коллекций считать тэги
  tagstore.start();
  for (const collection of collectionsWithTags) {
    const docs = await dbstore.get(collection, { tags: { $exists: true } }, { fields: { tags: 1 } });
    tagstore.addFromDocs(docs, collection);
  }
 
  treeguide.start();
};
