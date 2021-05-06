/**
 * alertservice.js
 */

const Alertengine = require('./alertengine');
const Alertmate = require('./alertmate');

module.exports = async function(holder) {
  const dm = holder.dm;
  const engine = new Alertengine(holder);
  
  const mate = new Alertmate(engine, dm);
  const docs = await dm.get('alerts');
  engine.start(docs);
  mate.start();
};
