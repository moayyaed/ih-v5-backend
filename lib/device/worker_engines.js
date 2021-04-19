/*
 * worker_engines.js
 *  Точка входа для движков устройств и сцен
 */

// const util = require('util');
const EventEmitter = require('events');
const { parentPort, workerData } = require('worker_threads');

const agent = require('./w_agent');
const Typo = require('./typo');
const Workdevo = require('./workdevo');
const Deviceengine = require('./w_deviceengine');

// console.log('WORKER STARTED!')
// wCore - отправляет сообщения main процессу и между движками
const wCore = new EventEmitter();

wCore.postMessage = (name, data) => {
    // Проверить, может зациклились
    if (wCore.currentScriptTs>0 && ((Date.now() - wCore.currentScriptTs) > 1000)) {
      process.exit(2);
    }

    parentPort.postMessage({name, data});
};

// Прием данных от основного процесса
parentPort.on('message', msg => {
  // receive:device:data
 
  const {name, data} = msg;
  // console.log('WORKER receive '+name)
  wCore.emit(name, data);
});

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
wCore.dnSet = {};
Object.keys(devSet).forEach(did => {
  wCore.devSet[did] = new Workdevo(devSet[did], wCore.typeMap, agent);
  wCore.dnSet[devSet[did].dn] = wCore.devSet[did];
});

// Запуск движка устройств
const engine = new Deviceengine(wCore, agent);
engine.start();