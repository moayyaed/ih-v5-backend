/*
 *
 */

const util = require('util');
const { parentPort, workerData } = require('worker_threads');


console.log('workerData =' + util.inspect(workerData, null, 4));
const {devSet, typeMap} = workerData;

// Прием - отправка данных в основной процесс
// parentPort.postMessage(msg);

parentPort.on('message', msg => {
  console.log('Worker get Message from Main ' + util.inspect(msg));
});
