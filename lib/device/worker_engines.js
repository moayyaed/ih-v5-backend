/*
 * worker_engines.js
 *  Точка входа для движков устройств и сцен
 */

const util = require('util');
const EventEmitter = require('events');
const { parentPort, workerData } = require('worker_threads');

const agent = require('./w_agent');
const Typo = require('./typo');
const Devo = require('./devo');
const Deviceengine = require('./w_deviceengine');

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
});

/*
wCore.on('received:device:data', getObj => {
  console.log('ON  received:device:data ' + util.inspect(getObj));
})
*/

// console.log('workerData =' + util.inspect(workerData, null, 4));
const {devSet, typeMap} = workerData;

// Создать свои структуры и запустить engines
agent.start(wCore);

// В типы нужно добавить обработчики (функции)
wCore.typeMap = new Map();
typeMap.forEach((typeItem, typeId ) => {
  wCore.typeMap.set(typeId, new Typo(typeItem));
});

// В устройства добавить команды и вызов обработчиков
wCore.devSet = {};
Object.keys(devSet).forEach(did => {
  wCore.devSet[did] = new Devo(devSet[did], wCore.typeMap, agent);
});

// Запуск движка устройств
const engine = new Deviceengine(wCore);
engine.start();