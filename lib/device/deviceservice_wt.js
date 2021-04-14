/**
 * deviceservice_wt.js
 * Сервер устройств
 */
const util = require('util');
const { Worker } = require('worker_threads');

const load = require('./load');
const Deviceengine = require('./deviceengine_m');
const Devicemate = require('./devicemate');


module.exports = async function(holder) {
  // Первая загрузка данных на старте - типы, устройства, сценарии ?
  // Анемичные объекты внутри holder - typeMap, devSet, ... ??
   await load(holder);
 
  // Запуск worker-а c этими данными
  let worker = startWorker();

  // На этой стороне - отслеживание изменений,  отправка данных для worker
  const engine = new Deviceengine(holder, worker); // deviceengine_m
  const mate = new Devicemate(engine); // devicemate_m
  mate.start();
  engine.start();

  // оперативная работа - отправка данных для worker по событиям - напрямую от holder



  function startWorker(cb) {
    const fullPath = require.resolve('./worker_engines');
    let w = new Worker(fullPath, { workerData: {devSet: holder.devSet, typeMap: new Map()} });
    // let w = new Worker(fullPath, { workerData: {devSet: holder.devSet, typeMap: holder.typeMap} });
    w.on('message', msg => {
      // cb(null, msg);
      // Обработка сообщений от worker-а
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