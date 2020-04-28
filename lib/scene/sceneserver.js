/**
 * sceneserver.js
 * Сервер сценариев
 */

const dm = require('../datamanager');
const Sceneengine = require('./sceneengine'); 
const Scenemate = require('./scenemate'); 

// Просто EE или через worker??
const Sceneagent = require('events');


module.exports = async function (holder) {
  const agent = new Sceneagent(); // Просто ee или через worker??

  const engine = new Sceneengine(holder, agent);
  const mate = new Scenemate(engine, dm);
 
  engine.start(await mate.start());

  
};
