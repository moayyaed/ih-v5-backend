/**
 * globalvarservice.js
 *
 */


const Globalset = require('./globalset');

module.exports = async function(holder) {

  holder.glSet = new Globalset(holder);
  
  const docs = await holder.dm.dbstore.get('globals', {}, { order: 'dn' });
  // TODO - текущее сохраненное значение 
  docs.forEach(doc => holder.glSet.addItem(doc));
};
