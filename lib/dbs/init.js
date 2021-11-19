/**
 * dbs/init.js - инициализация структур работы с данными
 */

// const util = require('util');


const dm = require('../datamanager');
const descriptor = require('../descriptor');
const appconfig = require('../appconfig');

const liststore = require('./liststore');
const tagstore = require('./tagstore');
const treeguide = require('../apptools/treeguide');
const projectutil = require('../utils/projectutil');
const imageutil = require('../utils/imageutil');
const soundutil = require('../utils/soundutil');
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
  await dm.reviseTableWithFolder('image', imageutil.sync, appconfig.getImagePath(), 'imagegroup');
  
  await dm.reviseTableWithFolder('docimage', imageutil.sync, appconfig.getDocImagePath(), 'docimagegroup');

  await dm.reviseTableWithFolder('project', projectutil.sync);

  await dm.reviseTableWithFolder('scene', sceneutils.sync);

  await dm.reviseTableWithFolder('sound', soundutil.sync, appconfig.get('soundpath'), 'soundgroup');

  // await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));

  // Считать установленные зависимости текущего проекта
  projectutil.updateCurrentProjectDeps(dm);

  // Списки для мобильного
  await dm.datagetter.prepareMobileData(dm);
};
