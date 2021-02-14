/**
 * sceneservice.js
 * Служба сценариев
 */

const util = require('util');

const dm = require('../datamanager');
const Scenengine = require('./sceneengine');

const Scenemate = require('./scenemate');
const sceneutils = require('./sceneutils');
const agent = require('./agent');

module.exports = async function(holder) {
  /*
  // Простые сценарии - это листы, мультисценарии - папки
  // await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs.filter(doc => !doc.folder)));
  await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));
  await dm.reviseTableWithFolder('multiscene', async docs => sceneutils.sync(docs, { multi: 1 }));
  const engine = new Scenengine(holder, agent);
  const mate = new Scenemate(engine);

  // Простые сценарии
  const sceneDocs = (await dm.dbstore.get('scenes')).filter(doc => sceneutils.isScriptDoc(doc));
  sceneDocs.forEach(doc => engine.addScene(doc));

  // Мультисценарии
  const msDocs = await dm.dbstore.get('multiscenes');
  const msScriptDocs = msDocs.filter(doc => sceneutils.isScriptDoc(doc, { multi: 1 }));
  msScriptDocs.forEach(doc => engine.addScene(doc, { multi: 1 }));

  const multiCallDocs = msDocs.filter(doc => sceneutils.isCallDoc(doc, { multi: 1 }));
  // multiCallDocs.forEach(doc => engine.addMultiCall(doc));
*/

  await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));

  const engine = new Scenengine(holder, agent);
  const mate = new Scenemate(engine);

  // Сценарии типа - это мультисценарии; экземпляры - каждое устройство типа
  // Из types получить список всех типов, у которых есть scriptOnChange, ..
  // scenemate - следить за изменениями
  // - добавление нового устройства с scriptOn...
  // - изменение правил запуска сценария par_On...
  // - сброс scriptOn... в типе (сценарий перестает работать)
  
  /*
  const typeScenes = await sceneutils.getTypeScenes(); // { _id: 't002__OnChange', multi: 1, type: 't002', par:<par_OnChange>, startEvent: '_OnChange'}
  for (const doc of typeScenes) {
    console.log(' Type scenes '+util.inspect(doc))
    const devices = await dm.dbstore.get('devices', { type: doc.type }, {fields:{dn:1, type:1}});
    console.log(doc.type+' devices = '+util.inspect(devices))
    if (devices.length) engine.addScene(doc, devices.map(dev => ({device:dev.dn})) );
  }
  */
  

  const sceneDocs = await sceneutils.getSceneDocs();
  sceneDocs.forEach(doc => engine.addScene(doc));

  mate.start();
  engine.start();
  console.log('INFO: Scene engine has started, script instanses: ' + sceneDocs.length);
};
