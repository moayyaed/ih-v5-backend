/*
 * worker_engines.js
 *  Точка входа для движков устройств и сцен
 */

const util = require('util');
const EventEmitter = require('events');
const { parentPort, workerData } = require('worker_threads');

const agent = require('./w_agent');
const Devo = require('./w_devo');

// wCore - отправляет сообщения main процессу и между движками
const wCore = new EventEmitter();
wCore.postMessage = (name, data) => {
    parentPort.postMessage({name, data});
};

// Прием данных от основного процесса
parentPort.on('message', msg => {
  // receive:device:data
  const {name, data} = msg;
  wCore.emit(name, data);
  console.log('Worker get Message from Main ' + util.inspect(msg));
});


console.log('workerData =' + util.inspect(workerData, null, 4));
const {devSet, typeMap} = workerData;

// Создать свои структуры и запустить engines
agent.start(wCore);

// В типы нужно добавить обработчики (функции)
wCore.typeMap = typeMap;

// В устройства добавить команды и вызов обработчиков
wCore.devSet = {};
Object.keys(devSet).forEach(did => {
  wCore.devSet[did] = new Devo(devSet[did], typeMap, agent);
});

// Запуск движка устройств
// deviceengine.start(wCore)