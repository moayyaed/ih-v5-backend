/**
 * deviceservice.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine');
const Devicemate = require('./devicemate');
const typestore = require('./typestore');
const agent = require('./agent');

// const datagetter = require('../appspec/datagetter');

module.exports = async function(holder) {
  const engine = new Deviceengine(holder, dm, agent);

  const typeDocs = await dm.dbstore.get('types', {}, {});
  const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });
  typestore.start(typeDocs, deviceDocs, dm);
  holder.typeMap = typestore.getTypeMap();

  const mate = new Devicemate(engine);
  await mate.start();

  const sysdevs = await mate.formSysdeviceArray();
  deviceDocs.push(...sysdevs);

  // Сохраненные значения вытащить из devparam + devicelog
  const devData = {};
  await getDataFromDeviceLog();
  await getDataFromDevParam();

  engine.start(deviceDocs, typestore, devData);


  async function getDataFromDeviceLog() {
    const docs = await dm.dbstore.get('devicelog', {}, {});
    docs.forEach(doc => {
      // {"did":"d0016","prop":"value","val":40,"ts":1602329108592,"_id":"F5kP34PryaWIxAUB"}
      const {did, prop} = doc;
      if (did && prop) {
        if (!devData[did]) devData[did] = {};
        devData[did][prop] = {val:doc.val, ts:doc.ts, src:doc.src}; // Переписывается на более новое
      }
    });
  }

  async function getDataFromDevParam() {
    const docs = await dm.dbstore.get('devparam', {}, {});
    docs.forEach(doc => {
      // {_id:'d0003_auto', val:1, ts, src}
      const [did, prop] = doc._id.split('_');
      if (did && prop) {
        if (!devData[did]) devData[did] = {};
        devData[did][prop] = {val:doc.val, ts:doc.ts, src:doc.src};
      }
    });
  }
};
