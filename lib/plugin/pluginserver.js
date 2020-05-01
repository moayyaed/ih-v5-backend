/**
 * pluginserver.js
 * 
*/

const dm = require('../datamanager');
const Pluginengine = require('./pluginengine'); 
const Pluginmate = require('./pluginmate'); 

// Просто EE 
const Pluginagent = require('events');


module.exports = async function (holder) {
  const agent = new Pluginagent(); // Просто eventEmitter?

  const engine = new Pluginengine(holder, agent);
  const mate = new Pluginmate(engine, dm);
 
  engine.start(await mate.start());
  
};