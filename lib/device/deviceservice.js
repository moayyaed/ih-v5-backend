/**
 * deviceservice.js
 * Сервер устройств
 */

const dm = require('../datamanager');

const Deviceengine = require('./deviceengine');
const Devicemate = require('./devicemate');
const typestore = require('./typestore');
const agent = require('./agent');
const deviceutil = require('./deviceutil');

module.exports = async function(holder) {
  const engine = new Deviceengine(holder, dm, agent);

  const typeDocs = await dm.dbstore.get('types', {}, {});
  const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });

  // Устройства нужны в typestore чтобы построить систему автоматического именованая
  typestore.start(typeDocs, deviceDocs, dm);
  holder.typeMap = typestore.getTypeMap();

  const mate = new Devicemate(engine);
  mate.start();
  engine.start(typestore);

  // Добавить системные устройства - они создаются на лету
  const sysdevs = await formSysdeviceArray();
  deviceDocs.push(...sysdevs);

  // Считать каналы
  const devChannels = await getChannelsFromDevhard();

  // Сохраненные значения вытащить из devparam + devicelog
  const devData = {};
  const devLog = {};
  await getDataFromDeviceLog();
  await getDataFromDevParam();

  // Создать устройства, заполнить значения свойств сохраненными, фиксировать привязку к каналам
  deviceDocs.forEach(item => {
    engine.addDevice(item, devData[item._id], devChannels[item._id], devLog[item._id]);
  });

  console.log('INFO: Device engine has started, devices: ' + deviceDocs.length);

  // Системные устройства - индикаторы создаются на лету
  // - Добавить индикатор(ы) БД
  // - Добавить индикаторы плагинов
  async function formSysdeviceArray() {
    const res = [];
    const dbSysObj = deviceutil.createUnitIndicatorDoc('dbagent');
    res.push(dbSysObj);

    const unitDocs = await dm.dbstore.get('units', {});
    for (const doc of unitDocs) {
      if (!doc.folder && doc.plugin && doc._id) {
        res.push(deviceutil.createUnitIndicatorDoc(doc._id));
      }
    }
    return res;
  }

  // Формировать devChannels - для одного устройства м б несколько записей с каналами - для отдельных свойств
  async function getChannelsFromDevhard() {
    const res = {};
    const docs = await dm.dbstore.get('devhard', {}, {});
    docs.forEach(doc => {
      // {"_id":"U80UL_Pce","unit":"emuls1","desc":"DI","period":"10","did":"d0007","prop":"value","chan":"emul002", "w":1, "r":1}
      const { did, prop } = doc;
      if (did && prop) {
        if (!res[did]) res[did] = {};
        res[did][prop] = doc; 
      }
    });
    return res;
  }

  // Формировать devData  из devparam + devicelog
  async function getDataFromDeviceLog() {
    const docs = await dm.dbstore.get('devicelog', {}, {order:'ts'});
    docs.forEach(doc => {
      // {"did":"d0016","prop":"value","val":40,"ts":1602329108592,"_id":"F5kP34PryaWIxAUB"}
      const { did, prop } = doc;
      if (did && prop) {
        if (!devData[did]) devData[did] = {};
        if (!devLog[did]) devLog[did] = [];
        devData[did][prop] = { val: doc.val, ts: doc.ts, src: doc.src }; // Переписывается на более новое
        devLog[did].push({...doc}); 
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
        devData[did][prop] = { val: doc.val, ts: doc.ts, src: doc.src };
      }
    });
  }
};
