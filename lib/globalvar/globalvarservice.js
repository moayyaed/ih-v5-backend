/**
 * globalvarservice.js
 * 
 */


// const Mate = require('./globalvarmate'); 
// const Engine = require('./globalvarengine'); 
const Globalset = require('./globalset'); 



module.exports = async function (holder) {
  /*
  const engine = new Engine(holder);
  const mate = new Mate(engine);
  engine.start(await mate.start());
  */
 

 holder.glSet = new Globalset(holder);
 const docs = await holder.dm.dbstore.get('globals', {}, { order: 'dn' });
 
 docs.forEach(doc =>  holder.glSet.addItem(doc));
 
};
