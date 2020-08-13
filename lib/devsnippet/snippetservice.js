/**
 * snippetservice.js
 * 
*/

const dm = require('../datamanager');
const Snippetengine = require('./snippetengine'); 
const Snippetmate = require('./snippetmate'); 



module.exports = async function (holder) {
 
  const engine = new Snippetengine(holder, dm);
  const mate = new Snippetmate(engine);
 
  engine.start(await mate.start());
  
};