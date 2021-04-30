/**
 * w_snippet.js
 *
 * Worker для запуска сниппетов
 */

const { parentPort, threadId } = require('worker_threads');

const hut = require('../utils/hut');


console.log('WARN: SNIPPET WORKER STARTED, threadId  '+threadId);


// Прием команд от основного процесса:
//  - run:snippet {target, filename, did} имя файла на запуск сниппетов + слепок целевого устройства (target?)
//  - update:snippet {filename} - unrequire
parentPort.on('message', msg => {
  const { name, data } = msg;
  switch (name) {
    case 'run:snippet': return tryRunSnippet(data);
    case 'update:snippet': return  hut.unrequire(data.filename);
    case 'ping': return parentPort.postMessage({ name:'pong' });

    default: console.log('ERROR: snippetWorker: Unknown message: '+name)
  }
});

function tryRunSnippet({did, target, file}) {
  try {
    const fn = require(file);
    if (typeof fn != 'function') throw { message: 'Модуль должен экспортировать функцию!' };

    const str = fn.toString();
    const arr = /^([^)]+)\)/.exec(str);

    if (!arr && arr[0]) {
      throw { message: 'Функция должна иметь аргументы!' };
    }

    const args = arr[0].split(',');
    if (!args || args.length != 2) {
      throw { message: 'Функция должна иметь 2 аргумента: (target, callback) ' };
    }

    // Будет запущен
    parentPort.postMessage({ name:'trace:snippet', data:{did, state:1, ts:Date.now()} });

    fn(target, (error, result) => {
      parentPort.postMessage({ name:'result:snippet', data:{did, error, result, ts:Date.now()} });
    }); 
  } catch (e) {
    // Ошибка при запуске сниппета
    const error = hut.getShortErrStr(e);
    const debugerror = hut.getErrStrWoTrace(e);
    parentPort.postMessage({ name:'trace:snippet', data:{did, state:0, error, debugerror, ts:Date.now()} });
  }
}
