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
  const engine = new Deviceengine(holder, dm, agent);

  const typeDocs = await dm.dbstore.get('types', {}, {});
  const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });
  typestore.start(typeDocs, deviceDocs, dm);

  holder.typeMap = typestore.getTypeMap();

  const mate = new Devicemate(engine);
  await mate.start();

  // const devhardDocs = await dm.dbstore.get('devhard', {});
  // Добавить из units для создания индикаторов плагинов как системных устройств
  const unitDocs = await dm.dbstore.get('units', {});

  for (const doc of unitDocs) {
    if (!doc.folder && doc.plugin && doc._id) {
      deviceDocs.push(getUnitIndicatorObj(doc));
    }
  }
  engine.start(deviceDocs, typestore);

  function getUnitIndicatorObj(doc) {
    const _id = '__UNIT_' + doc._id;
    return { _id, dn: _id, sys: 1, name: 'Plugin indicator ' + doc._id, type: '__SYS_INDICATOR' };
  }
};
