/**
 * sceneservice.js
 * Служба сценариев
 */

const util = require('util');

const Scenengine = require('./sceneengine');

const Scenemate = require('./scenemate');
const sceneutils = require('./sceneutils');
const agent = require('./agent');

module.exports = async function(holder) {
  const dm = holder.dm;
  await dm.reviseTableWithFolder('scene', async docs => sceneutils.sync(docs));

  const engine = new Scenengine(holder, agent);
  const mate = new Scenemate(engine);

  const sceneDocs = (await dm.dbstore.get('scenes')).filter(doc => !doc.folder);
  sceneDocs.forEach(doc => engine.addScene(doc));

  mate.start();
  engine.start();
  console.log('INFO: Scene engine has started, script docs: ' + sceneDocs.length);
};
