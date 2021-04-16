/**
 * deviceservice_wt.js
 * Сервер устройств через worker
 */

const util = require('util');
const { Worker } = require('worker_threads');

const hut = require('../utils/hut');
const load = require('./load');
const Deviceengine = require('./deviceengine_main');
const Devicemate = require('./devicemate');
const device_struct = require('./device_struct');
const agent = require('./agent');



module.exports = async function(holder) {
  const callbackMap = {};
  
  // Первая загрузка данных на старте - типы, устройства
   agent.start(holder);
   await load(holder, agent);  
   
 
  // Запуск worker-а c этими данными
  let worker = startWorker();

  // На этой стороне - отслеживание изменений,  отправка данных для worker
  const engine = new Deviceengine(holder, agent, worker); // deviceengine_m
  const mate = new Devicemate(engine); 
  mate.start();
  engine.start();

  // оперативная работа - отправка данных для worker по событиям - внутри engine
  /*
  holder.on('received:device:data', getObj => {
    console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+' TO WORKER: '+util.inspect(getObj))
    worker.postMessage({name:'received:device:data', data:getObj })
  });
  */
  // Запуск workera - также выполняется и перезапуск
  function startWorker() {
   
    const aTypeMap = new Map();
    for (let [key, value] of holder.typeMap) {
      aTypeMap.set(key, hut.clone(value));
    }

    const aDevSet = {};
    for (let did of Object.keys(holder.devSet)) {
      aDevSet[did] =  device_struct.extract(holder.devSet[did]);
      // console.log(did+' EXTRACTED '+util.inspect(aDevSet[did]))
    }

    const fullPath = require.resolve('./worker_engines');
    let w = new Worker(fullPath, { workerData: { devSet: aDevSet, typeMap: aTypeMap} });
   
    w.on('message', msg => {
      if (msg.id) {
        // Это ответ на запрос
        const cb = callbackMap[msg.id];
        if (cb) {
          cb( msg.error || null, msg.payload);
          delete callbackMap[msg.id];
        }

      } else {

      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+'_WT FROM WORKER: '+util.inspect(msg))
      // Принять данные - через сообщения holder
      if (msg.name) {
        holder.emit(msg.name, msg.data);
      }
    }

    });

    w.on('error', (err) => {
      console.log(`Worker ERROR: ${util.inspect(err)}`);
    });
    w.on('exit', code => {
      console.log(`Worker stopped with exit code ${code}`);
    });
    return w;
  }

  // TODO Отслеживание, что worker не повис.
  // Если повис - terminate и запуск заново с данными из holder (текущий слепок данных)

}