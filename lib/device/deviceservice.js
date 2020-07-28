/**
 * deviceservice.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine');
const Devicemate = require('./devicemate');

const typestore = require('./typestore');
const agent = require('./agent'); 

module.exports = async function(holder) {
  
  // const engine = new Deviceengine(holder, typestore);
  const engine = new Deviceengine(holder, dm, agent);

  const typeDocs = await dm.dbstore.get('types', {}, {});
  const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });
  typestore.start(typeDocs, deviceDocs, dm);

  holder.typeMap = typestore.getTypeMap();

  const mate = new Devicemate(engine);
  await mate.start();

  const devhardDocs = await dm.dbstore.get('devhard', {});

  engine.start(deviceDocs, devhardDocs, typestore);
};
