/**
 * resourceserver.js
 * 
 */

const dm = require('../datamanager');
// const Resourceengine = require('./resourceengine'); 
const Resourcemate = require('./resourcemate'); 


module.exports = async function (holder) {
 

  // const engine = new Resourceengine(holder);
  const engine = '';
  const mate = new Resourcemate(engine, dm);
  mate.start();
  // engine.start(await mate.start());

};
