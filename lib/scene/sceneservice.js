/**
 * sceneservice.js
 * Служба сценариев
 */

const dm = require('../datamanager');
const Sceneengine = require('./sceneengine');
const Scenemate = require('./scenemate');
const sceneutils = require('./sceneutils');

const agent = require('./agent');

module.exports = async function(holder) {

  // Простые сценарии - это листы, мультисценарии - папки
  // await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs.filter(doc => !doc.folder)));
  await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));
  await dm.reviseTableWithFolder('multiscene', async docs => sceneutils.sync(docs, { multi: 1 }));
  const engine = new Sceneengine(holder, agent);
  const mate = new Scenemate(engine);

  // Простые сценарии
  const sceneDocs = (await dm.dbstore.get('scenes')).filter(doc => sceneutils.isScriptDoc(doc));
  sceneDocs.forEach(doc => engine.addScene(doc));

  // Мультисценарии
  const msDocs = await dm.dbstore.get('multiscenes');
  const msScriptDocs = msDocs.filter(doc => sceneutils.isScriptDoc(doc, { multi: 1 }));
  msScriptDocs.forEach(doc => engine.addScene(doc, { multi: 1 }));

  const multiCallDocs = msDocs.filter(doc => sceneutils.isCallDoc(doc, { multi: 1 }));
  multiCallDocs.forEach(doc => engine.addMultiCall(doc));

  mate.start();
  engine.start();
  console.log('INFO: Scene engine has started, script instanses: ' + sceneDocs.length + multiCallDocs.length);
};
