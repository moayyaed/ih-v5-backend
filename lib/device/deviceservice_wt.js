/**
 * deviceservice_wt.js
 * Сервер устройств через worker
 */

const util = require('util');
const shortid = require('shortid');
const { Worker } = require('worker_threads');

const hut = require('../utils/hut');
const load = require('./load');
const device_struct = require('./device_struct');
const Deviceengine = require('./deviceengine_main');
const Devicemate = require('./devicemate');
const Basedevo = require('./basedevo');
const Traco = require('./traco');

module.exports = async function(holder) {
  holder.devSet = {};
  holder.dnSet = {};

  // Первая загрузка данных на старте - типы, устройства, глобальные перем
  const devStructSet = await load(holder);

  // Запуск worker-а. Можно передать только структуры (анемичные объекты)
  // Устройства уже готовы
  const typeStructMap = getTypeStructMap();
  holder.deviceWorker = startWorker(devStructSet, typeStructMap, holder.global.glByDid);

  // devSet На этой стороне - отслеживание изменений структуры и атрибутов устр-ва,  отправка данных для worker
  for (const did of Object.keys(devStructSet)) {
    const item = devStructSet[did];
    if (item.dn) {
      holder.devSet[item._id] = new Basedevo(item, holder.typeMap);
      holder.dnSet[item.dn] = holder.devSet[item._id]; // Объект устройства для обращения по dn
    } else {
      console.log('WARN: devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }

  const engine = new Deviceengine(holder); // deviceengine_m
  const mate = new Devicemate(engine);
  mate.start();
  engine.start();

  console.log('INFO: Device engine has started, devices: ' + Object.keys(holder.devSet).length);

  // Вся оперативная работа - отправка данных для worker по событиям - внутри engine

  // Построить множество пользовательских обработчиков - из всех типов
  let currentScript = '';
  holder.traceSet = {};
  fillTraceSet();

  // перехват сообщений с callback - для возврата по запросам
  const callbackMap = {};
  holder.on('getcb:device:raw', (msg, cb) => {
    // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' TO WORKER: ' + util.inspect(msg));
    msg.id = shortid.generate();
    callbackMap[msg.id] = cb;
    holder.deviceWorker.postMessage({ name: 'getcb:device:raw', data: { ...msg } });
  });

  // Запуск workera - также выполняется и перезапуск
  function startWorker(devSet, typeMap, glSet) {
    const fullPath = require.resolve('../deviceworker/worker_engines');
    let w = new Worker(fullPath, { workerData: { devSet, typeMap, glSet } });

    w.on('message', msg => {
      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+'_WT FROM WORKER: '+util.inspect(msg))
      if (msg.data && msg.data.id) {
        // Это ответ на запрос
        const cb = callbackMap[msg.data.id];
        if (cb) {
          cb(msg.data.error || null, msg.data.result);
          delete callbackMap[msg.data.id];
        }
      } else if (msg.name == 'trace:handler') {
        tracing(msg.data);
      } else if (msg.name) {
        // через сообщения holder
        holder.emit(msg.name, msg.data);
      }
    });

    w.on('error', err => {
      console.log(`Worker ERROR: ${util.inspect(err)}`);
    });
    w.on('exit', code => {
      console.log(`WARN: Worker stopped with exit code ${code}`);
    });
    return w;
  }

  // Сделать новые слепки и запустить заново
  function restartWorker() {
    if (holder.deviceWorker.threadId > 0) return;
    holder.deviceWorker = startWorker(getDevStructSet(), getTypeStructMap(), holder.global.glByDid);
  }

  function getTypeStructMap() {
    const res = new Map();
    for (let [key, value] of holder.typeMap) {
      res.set(key, hut.clone(value));
    }
    return res;
  }

  function getDevStructSet() {
    const res = {};
    for (let did of Object.keys(holder.devSet)) {
      res[did] = device_struct.extract(holder.devSet[did]);
    }
    return res;
  }

  // Выбрать все пользовательские обработчики
  // Из свойств - с fuse=2

  function fillTraceSet() {
    for (let [type, typeObj] of holder.typeMap) {
      // По свойствам - если fuse = 2?
      Object.keys(typeObj.props).forEach(prop => {
        if (typeObj.props[prop].fuse == 2 && typeObj.props[prop].handler) {
          const hanid = type + '_' + prop;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.props[prop].handler);
        }
        if (typeObj.props[prop].format == 2 && typeObj.props[prop].formathandler) {
          const hanid = type + '__format_' + prop;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.props[prop].formathandler);
        }
      });

      // Верхнего уровня - они все пользовательские
      Object.keys(typeObj.onHandlers).forEach(event => {
        if (typeObj.onHandlers[event].filename) {
          const hanid = type + '_' + event;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.onHandlers[event]);
        }
      });
    }
  }

  // Запускается по сообщению 'trace:handler' от worker-а
  // Worker может сам заблокировать скрипт при ошибке (runtime error try-catch)
  function tracing({ did, hanid, state, ts, blk, error = '' }) {
    if (!holder.traceSet[hanid]) holder.traceSet[hanid] = new Traco(hanid);

    if (state) {
      holder.traceSet[hanid].fixStart({ did, ts });
      currentScript = hanid;
    } else {
      holder.traceSet[hanid].fixStop({ did, ts, blk, error });
      currentScript = '';
    }
    if (blk) {
    }
  }

  // TODO Отслеживание, что worker не повис.
  // Если повис - terminate и запуск заново с данными из holder (текущий слепок данных)
  // 1 - если есть handler, работающий более 1 сек - сразу остановить worker и блокировать сценарий
  // ?? 2 ?? - сообщения от workera поступили более 1 сек назад - отправить ping с callback?
  setInterval(() => {
    const threadId = holder.deviceWorker.threadId;
    // console.log('threadId ' + threadId );
    if (threadId < 0) {
      // console.log('threadId ' + threadId + ' TRY RESTART Worker');
      console.log('WARN: Worker has terminated. Try restart. ');
      restartWorker();
      return;
    }

    if (currentScript) {
      if (Date.now() - holder.traceSet[currentScript].startTs > 1000) {
        holder.deviceWorker.terminate();

        console.log('WARN: Script "' + currentScript + '"  running > 1s. TERMINATE WORKER!');
        holder.traceSet[currentScript].blk = 1;
        holder.traceSet[currentScript].error = 'Цикл выполнения > 1 sec';

        engine.setScriptBlk(currentScript, 1);
        currentScript = '';
      }
    }
  }, 1000);
};
