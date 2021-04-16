/**
 * deviceservice_wt.js
 * Сервер устройств
 */

const util = require('util');
const { Worker } = require('worker_threads');

const hut = require('../utils/hut');
const load = require('./load');
const Deviceengine = require('./deviceengine_m');
const Devicemate = require('./devicemate');


module.exports = async function(holder) {
  // Первая загрузка данных на старте - типы, устройства
   await load(holder);  
   
 
  // Запуск worker-а c этими данными
  let worker = startWorker();

  // На этой стороне - отслеживание изменений,  отправка данных для worker
  const engine = new Deviceengine(holder, worker); // deviceengine_m
  const mate = new Devicemate(engine); 
  mate.start();
  engine.start();

  // оперативная работа - отправка данных для worker по событиям - напрямую от holder

  holder.on('received:device:data', getObj => {
    console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+' TO WORKER: '+util.inspect(getObj))
    worker.postMessage({name:'received:device:data', data:getObj })
  });

  // Запуск workera - также выполняется и перезапуск
  function startWorker() {
   
    const aTypeMap = new Map();
    for (let [key, value] of holder.typeMap) {
      aTypeMap.set(key, hut.clone(value));
    }

    const aDevSet = {};
    for (let did of Object.keys(holder.devSet)) {
      aDevSet[did] =  hut.clone(holder.devSet[did]);
    }

    const fullPath = require.resolve('./worker_engines');
    let w = new Worker(fullPath, { workerData: { devSet: aDevSet, typeMap: aTypeMap} });
    // let w = new Worker(fullPath, { workerData: {devSet: holder.devSet, typeMap: holder.typeMap} });
    w.on('message', msg => {

      console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+' FROM WORKER: '+util.inspect(msg.data))
      // Принять данные - через сообщения holder??

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