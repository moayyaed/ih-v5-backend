/**
 * deviceservice.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine');
const Devicemate = require('./devicemate');
const typestore = require('./typestore');
const agent = require('./agent');

const liststore = require('../dbs/liststore');
const datagetter = require('../appspec/datagetter');


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
      const sysObj = datagetter.getUnitIndicatorObj(doc._id);
      deviceDocs.push(sysObj);
  
      liststore.onInsertDocs('device', [sysObj]);
    }
  }
  engine.start(deviceDocs, typestore);

};
