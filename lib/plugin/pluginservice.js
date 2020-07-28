/**
 * pluginservice.js
 * 
*/

const dm = require('../datamanager');
const Pluginengine = require('./pluginengine'); 
const Pluginmate = require('./pluginmate'); 

// Просто EE 
const Pluginagent = require('events');


module.exports = async function (holder) {
  const agent = new Pluginagent(); // Просто eventEmitter?

  const engine = new Pluginengine(holder, dm, agent);
  const mate = new Pluginmate(engine);
 
  engine.start(await mate.start());
  
};