/*
 * worker_engines.js
 *  Точка входа для движков устройств и сцен
 */

const util = require('util');
const EventEmitter = require('events');
const { parentPort, workerData, threadId } = require('worker_threads');

const agent = require('./w_agent');
const Typo = require('../device/typo');
const Workdevo = require('./w_devo');
const Deviceengine = require('./w_deviceengine');
const Alertengine = require('./w_alertengine');
const Globalman = require('./w_globalmanager');

console.log('WARN: WORKER STARTED, threadId  '+threadId);
// wCore - отправляет сообщения main процессу и между движками
const wCore = new EventEmitter();

wCore.postMessage = (name, data) => {
  // console.log('WORKER BEFORE postMessage '+name)
    // Проверить, может зациклились
    if (wCore.currentScriptTs>0 && ((Date.now() - wCore.currentScriptTs) > 1000)) {
      process.exit(77);
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

const {devSet, typeMap, glSet} = workerData;

// Создать свои структуры и запустить engines
agent.start(wCore);

// формировать global
wCore.global = new Globalman(wCore);
Object.keys(glSet).forEach(did => {
  // wCore.global.addItem(did, glSet[did]); // данные уже внутри, поэтому addItem не исп
  wCore.global.glByDid[did] = glSet[did];
  wCore.global.glByDn[glSet[did].dn] = wCore.global.glByDid[did]
});


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

wCore.global.start();

// Запуск движка устройств
const engine = new Deviceengine(wCore, agent);
engine.start();

// 
const alertengine = new Alertengine(wCore);
alertengine.start();  // Нужна загрузка активных алертов??


process.on('uncaughtException', e => console.log('ERROR: WORKER uncaughtException: ' + util.inspect(e)));
process.on('unhandledRejection', (reason, promise) =>
  console.log('ERROR: WORKER  unhandledRejection: Reason ' + util.inspect(reason) + '. Promise ' + util.inspect(promise))
);