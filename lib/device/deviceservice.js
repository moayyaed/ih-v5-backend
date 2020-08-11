/**
 * deviceservice.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine');
const Devicemate = require('./devicemate');
const typestore = require('./typestore');
const agent = require('./agent');

const datagetter = require('../appspec/datagetter');

module.exports = async function(holder) {
  const engine = new Deviceengine(holder, dm, agent);

  const typeDocs = await dm.dbstore.get('types', {}, {});
  const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });
  typestore.start(typeDocs, deviceDocs, dm);
  holder.typeMap = typestore.getTypeMap();

  const mate = new Devicemate(engine);
  await mate.start();

  const sysdevs = await datagetter.formSysdeviceArray();
  deviceDocs.push(...sysdevs);
  const globalDocs = await dm.dbstore.get('globals', {}, {});
  engine.start(deviceDocs, typestore, globalDocs);
};
