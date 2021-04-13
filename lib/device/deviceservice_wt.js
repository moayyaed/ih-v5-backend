/**
 * deviceservice_wt.js
 * Сервер устройств
 */
const util = require('util');
const { Worker } = require('worker_threads');

const load = require('./load');

// const Deviceengine = require('./deviceengine');
// const Devicemate = require('./devicemate');
// const typestore = require('./typestore');
// const agent = require('./agent');
// const deviceutil = require('./deviceutil');

module.exports = async function(holder) {
  // const dm = holder.dm;

  // Первая загрузка данных на старте - типы, устройства, сценарии ?
   await load(holder);
  // const typeMap = new Map();

  // Данные загрузить в devSet и typemanager (typestore)
  // const devSet = {};
  // holder.devSet = devSet; // holder.devSet - анемичные объекты (без методов) 

  // const mate = new Devicemate(dm);
  // mate.start();
  // engine.start(typestore);
  // Обработчики типа - сформировать
  // engine.formTypeHandlerSets(typeDocs);

  // Запуск worker-а c этими данными
  const worker = startWorker();

  // Создание агента для связи с worker
  const agent = {
    send:(msg => {
      worker.postMessage(msg);
    })
  }

  function startWorker(cb) {
    const fullPath = require.resolve('./worker_engines');
    let w = new Worker(fullPath, { workerData: {devSet: holder.devSet, typeMap: holder.typeMap} });
    // let w = new Worker(fullPath, { workerData: {devSet: holder.devSet, typeMap: new Map()} });
    w.on('message', msg => {
      // cb(null, msg);
      // Обработка сообщений
    });
    w.on('error', (err) => {
      console.log(`Worker ERROR: ${util.inspect(err)}`);
    });
    w.on('exit', code => {
      console.log(`Worker stopped with exit code ${code}`);
    });
    return w;
  }

  // Отслеживание, что worker не повис.
  // Если повис - terminate и запуск заново с данными из holder (текущий слепок данных)

  // Запуск devicemate для отслеживания изменений и передачи данных на worker
/*
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
  deviceDocs.forEach(item => {
    engine.addDevice(item, devData[item._id] || 'boot', devChannels[item._id]);
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
*/
}