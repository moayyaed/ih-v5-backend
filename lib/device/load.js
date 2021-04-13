/**
 * load.js
 * Загрузка структур данных на старте
 * 
 */
const util = require('util');

const deva = require('./devfactory');
const typestore = require('./typestore');
const deviceutil = require('./deviceutil');

module.exports = async function (holder) {

  const dm = holder.dm;

  const typeDocs = (await dm.dbstore.get('types')).filter(doc => !doc.folder);
  const deviceDocs = (await dm.dbstore.get('devices', {}, { order: 'dn' })).filter(doc => !doc.folder);

  // Устройства нужны в typestore чтобы построить систему автоматического именованая
  typestore.start(typeDocs, deviceDocs, dm);
  holder.typeMap = typestore.getTypeMap();

  // Добавить системные устройства - они создаются на лету
  const sysdevs = await formSysdeviceArray();
  deviceDocs.push(...sysdevs);

  // Считать каналы
  const devChannels = await getChannelsFromDevhard();

  // Сохраненные значения вытащить из devparam + devcurrent
  const devData = {};
  await getCurrentData('devcurrent');
  await getCurrentData('devparam');

  // Создать устройства, заполнить значения свойств сохраненными, фиксировать привязку к каналам
  // Журналы устройств здесь не цепляются, нужно их будет загружать при запросе
  // Здесь создать элементы 
  holder.devSet = {}; 
  holder.dnSet = {}; 
  deviceDocs.forEach(item => {
    addDevice(item, devData[item._id], devChannels[item._id]);
  });

  console.log('INFO: Device engine has started, devices: ' + deviceDocs.length);


  /**
   * Добавить новое устройство
   *
   * @param {*} doc - запись из таблицы
   * @param {*} dataObj - сохраненные значения динамических свойств
   * @param {*} chanObj - привязки к каналам из devhard
   */
  function addDevice(doc, dataObj, chanObj) {
    if (doc.dn) {
      // holder.devxSet[doc._id] = new Devo(doc, this.typestore, this.agent, dataObj, chanObj);
      holder.devSet[doc._id] = deva.create(doc, dataObj, chanObj);
      holder.dnSet[doc.dn] = holder.devSet[doc._id]; // Объект устройства для обращения по dn, свойства плоские
    } else {
      console.log('WARN: devices._id = ' + doc._id + '. NO dn! SKIPPED doc: ' + util.inspect(doc));
    }
  }

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

  async function getCurrentData(table) {
    const docs = await dm.dbstore.get(table);
    docs.forEach(doc => {
      // {_id:'d0003.auto', val:1, ts, src}
      const [did, prop] = doc._id.split('.');
      if (did && prop) {
        if (!devData[did]) devData[did] = {};
        devData[did][prop] = doc;
      }
    });
  }
};



 