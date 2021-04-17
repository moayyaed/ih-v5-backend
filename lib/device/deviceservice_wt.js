/**
 * deviceservice_wt.js
 * Сервер устройств через worker
 */

const util = require('util');
const shortid = require('shortid');
const { Worker } = require('worker_threads');

const hut = require('../utils/hut');
const load = require('./load');
const Deviceengine = require('./deviceengine_main');
const Devicemate = require('./devicemate');
const Basedevo = require('./basedevo');
// const agent = require('./agent');

module.exports = async function(holder) {
  const callbackMap = {};

  holder.devSet = {};
  holder.dnSet = {};


  // Первая загрузка данных на старте - типы, устройства
  const devStructSet = await load(holder);

  // Запуск worker-а. Можно передать только структуры (анемичные объекты)
  const typeStructMap = new Map();
  for (let [key, value] of holder.typeMap) {
    typeStructMap.set(key, hut.clone(value));
  }
  holder.deviceWorker = startWorker(devStructSet, typeStructMap);

  // На этой стороне - отслеживание изменений структуры и атрибутов устр-ва,  отправка данных для worker
  
  for (const did of Object.keys(devStructSet)) {
    const item = devStructSet[did];
    if (item.dn) {
      holder.devSet[item._id] = new Basedevo(item, holder.typeMap);
      holder.dnSet[item.dn] = holder.devSet[item._id]; // Объект устройства для обращения по dn
    } else {
      console.log('WARN: devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }

  const engine = new Deviceengine(holder); // deviceengine_m
  const mate = new Devicemate(engine);
  mate.start();
  engine.start();
  console.log('INFO: Device engine has started, devices: ' + Object.keys(holder.devSet).length);

  // оперативная работа - отправка данных для worker по событиям - внутри engine
  // Здесь - перехват сообщений с callback - для возврата по запросам
  holder.on('getcb:device:raw', (msg, cb) => {
    console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' TO WORKER: ' + util.inspect(msg));
    msg.id = shortid.generate();
    callbackMap[msg.id] = cb;
    holder.deviceWorker.postMessage({ name: 'getcb:device:raw', data: {...msg} });
  });

  // Запуск workera - также выполняется и перезапуск
  function startWorker(devSet, typeMap) {
    const fullPath = require.resolve('./worker_engines');
    let w = new Worker(fullPath, { workerData: { devSet, typeMap } });

    w.on('message', msg => {
   // console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+'_WT FROM WORKER: '+util.inspect(msg))
      if (msg.data && msg.data.id) {
        // Это ответ на запрос
        const cb = callbackMap[msg.data.id];
        if (cb) {
          cb(msg.data.error || null, msg.data.result);
          delete callbackMap[msg.data.id];
        }
      } else if (msg.name) {
        // console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+'_WT FROM WORKER: '+util.inspect(msg))
        // Принять данные - через сообщения holder

        holder.emit(msg.name, msg.data);
      }
    });

    w.on('error', err => {
      console.log(`Worker ERROR: ${util.inspect(err)}`);
    });
    w.on('exit', code => {
      console.log(`Worker stopped with exit code ${code}`);
    });
    return w;
  }

  // TODO Отслеживание, что worker не повис.
  // Если повис - terminate и запуск заново с данными из holder (текущий слепок данных)
};
