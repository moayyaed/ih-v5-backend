/**
 * dbs/init.js - инициализация структур работы с данными
 */

// const util = require('util');


const dm = require('../datamanager');
const descriptor = require('../descriptor');
// const appconfig = require('../appconfig');

const liststore = require('./liststore');
const tagstore = require('../api/tagstore');
const treeguide = require('../api/treeguide');
const projectutil = require('../utils/projectutil');
const imageutil = require('../utils/imageutil');
const sceneutils = require('../scene/sceneutils');

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

  // Синхронизировать таблицы с папками
  await dm.reviseTableWithFolder('image', imageutil.sync);

  await dm.reviseTableWithFolder('project', projectutil.sync);

  await dm.reviseTableWithFolder('scene', sceneutils.sync);
  // await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));

  // Считать установленные зависимости текущего проекта
  projectutil.updateCurrentProjectDeps(dm);
};
