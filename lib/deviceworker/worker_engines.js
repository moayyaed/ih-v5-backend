/*
 * worker_engines.js
 *  Стартовый модуль worker-а (устройства и сценарии)
 *  - создает объект wCore
 *  - из workerData формирует объекты типов, устройств, глобальных переменных, сценариев
 *  - запускает обработчики для обмена данными с основным процессом
 *  - запускает движки w_deviceengine, w_sceneengine
 */

const util = require('util');
const EventEmitter = require('events');
const { parentPort, workerData, threadId } = require('worker_threads');

const agent = require('./w_agent');
const Typo = require('../device/typo');
const Workdevo = require('./w_devo');
const Deviceengine = require('./w_deviceengine');

const Sceneengine = require('./w_sceneengine');
const W_scenemate = require('./w_scenemate');

const W_globalman = require('./w_globalmanager');
const W_globalmate = require('./w_globalmate');

console.log('WARN: WORKER STARTED, threadId  ' + threadId);

// wCore - отправляет сообщения main процессу и между движками
const wCore = new EventEmitter();
const { devSet, typeMap, glSet, sceneSet, placeList, settings, boot } = workerData; // boot - флаг, что worker запущен впервые
wCore.boot = boot;

wCore.postMessage = (name, data) => {
  // console.log('WORKER BEFORE postMessage '+name)
  // Проверить, может зациклились
  if (wCore.currentScriptTs > 0 && Date.now() - wCore.currentScriptTs > 1000) {
    process.exit(77);
  }

  parentPort.postMessage({ name, data });
};

// Прием данных от основного процесса
parentPort.on('message', msg => {
  const { name, data } = msg;
  // console.log('WORKER receive '+name)
  wCore.emit(name, data);
});

// Создать свои структуры и запустить engines
agent.start(wCore, placeList);

// формировать global
wCore.global = new W_globalman(wCore);
Object.keys(glSet).forEach(did => {
  // wCore.global.addItem(did, glSet[did]); // данные уже внутри, поэтому addItem не исп
  wCore.global.glByDid[did] = glSet[did];
  wCore.global.glByDn[glSet[did].dn] = wCore.global.glByDid[did];
});

// Запускать нужно когда определены устройства - для отработки триггеров
// wCore.global.start();

// В типы нужно добавить обработчики (функции)
wCore.typeMap = new Map();
typeMap.forEach((typeItem, typeId) => {
  wCore.typeMap.set(typeId, new Typo(typeItem));
});

// В устройства добавить команды и вызов обработчиков
wCore.devSet = {};
wCore.dnSet = {};
Object.keys(devSet).forEach(did => {
  if (devSet[did].type) {
    wCore.devSet[did] = new Workdevo(devSet[did], wCore.typeMap, agent);
    wCore.dnSet[devSet[did].dn] = wCore.devSet[did];
  } else {
    console.log('ERROR: Device ' + did + ' Missing type!');
  }
});

const globalmate = new W_globalmate(wCore.global);
globalmate.start();
wCore.global.start();

// Запуск движка устройств, он выполняет обработчики
const engine = new Deviceengine(wCore, agent);
engine.start();

// Запуск движка сценариев
const sceneengine = new Sceneengine(wCore, sceneSet, settings);
const scenemate = new W_scenemate(sceneengine);
scenemate.start();
sceneengine.start();

process.on('uncaughtException', e => console.log('ERROR: WORKER uncaughtException: ' + util.inspect(e)));
process.on('unhandledRejection', (reason, promise) =>
  console.log(
    'ERROR: WORKER  unhandledRejection: Reason ' + util.inspect(reason) + '. Promise ' + util.inspect(promise)
  )
);
