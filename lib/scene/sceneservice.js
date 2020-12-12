/**
 * sceneservice.js
 * Служба сценариев
 */

const dm = require('../datamanager');
const Sceneengine = require('./sceneengine');
const Scenemate = require('./scenemate');
const sceneutils = require('./sceneutils');

// Просто EE или через worker??
const Sceneagent = require('events');

module.exports = async function(holder) {
  const agent = new Sceneagent();

  // Простые сценарии - это листы, мультисценарии - папки
  // await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs.filter(doc => !doc.folder)));
  await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(selectScriptDocs(docs)));
  await dm.reviseTableWithFolder('multiscene', async docs => sceneutils.sync(docs.filter(doc => !doc.folder)));
  const engine = new Sceneengine(holder, agent);
  const mate = new Scenemate(engine);

  // Простые сценарии
  const sceneDocs = (await dm.dbstore.get('scenes')).filter(doc => !doc.folder);
  sceneDocs.forEach(doc => engine.addScene(doc));

  // Мультисценарии
  /*
  const msDocs = await this.dm.dbstore.get('multiscenes');
  msDocs.filter(doc => doc.folder).forEach(doc => engine.addMultiScene(doc));
  msDocs.filter(doc => !doc.folder).forEach(doc => engine.addMultiSceneInstance(doc));
  */
  mate.start();
  engine.start();
  console.log('INFO: Scene engine has started, script instanses: ' + sceneDocs.length);


  function selectScriptDocs(docs) {
    return docs ? docs.filter(doc => !doc.folder) : '';
  }

  function selectMultiSriptDocs(docs) {
    return docs ? docs.filter(doc => doc.folder) : '';
  }
};
