/**
 * sceneservice.js
 * Служба сценариев
 */

const dm = require('../datamanager');
const Sceneengine = require('./sceneengine'); 
const Scenemate = require('./scenemate'); 

// Просто EE или через worker??
const Sceneagent = require('events');


module.exports = async function (holder) {
  const agent = new Sceneagent(); 

  const engine = new Sceneengine(holder,dm, agent);
  const mate = new Scenemate(engine);
 
  engine.start(await mate.start());

  
};
