/**
 * globalvarservice.js
 * 
 */


const Mate = require('./globalvarmate'); 
const Engine = require('./globalvarengine'); 



module.exports = async function (holder) {
  const engine = new Engine(holder);
  const mate = new Mate(engine);
  engine.start(await mate.start());

};
