/**
 * 
 */

const { parentPort, workerData, threadId } = require('worker_threads');

const EventEmitter = require('events');

const wCore = new EventEmitter();

wCore.postMessage = (name, data) => {
  // console.log('WORKER BEFORE postMessage '+name)
    // Проверить, может зациклились
    if (wCore.currentScriptTs>0 && ((Date.now() - wCore.currentScriptTs) > 1000)) {
      process.exit(2);
    }

    parentPort.postMessage({name, data});
};

// Прием команд от основного процесса:
//  - run:snippet {target, filename} имя файла на запуск сниппетов + слепок целевого устройства (target?)
//  - reset:snippet {filename} - unrequire
parentPort.on('message', msg => {
 
  const {name, data} = msg;
  // console.log('WORKER receive '+name)
  wCore.emit(name, data);
});