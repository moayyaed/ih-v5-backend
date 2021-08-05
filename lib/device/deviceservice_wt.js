/**
 * deviceservice_wt.js
 * Сервер устройств через worker
 * - загружает типы, устройства, глобальные переменные
 * - загружает сценарии
 * - запускает worker, передает им загруженные структуры
 *   Можно передать только структуры (анемичные объекты)
 *
 * - в главном процессе соотв структуры поддерживаются в актуальном состоянии (постоянно синхронизируются)
 *
 *  Для отслеживания изменений настроек запускает:
 * - deviceengine+devicemate
 * - sceneengine+scenemate
 *
 * Отслеживает выполнение пользовательских обработчиков и сценариев в worker-e (tracing):
 *   currentScript - текущий выполняемый скрипт - не может выполняться более 1 сек синхронно
 *   В случае, если время выполнения > 1 сек, worker перезагружается (terminate - restart)
 *   При перезагрузке структуры передаются в актуальном состоянии
 *
 */

const util = require('util');
const shortid = require('shortid');
const { Worker } = require('worker_threads');

const hut = require('../utils/hut');

const load = require('./load');
const Globalman = require('./globalmanager');
const device_struct = require('./device_struct');
const Deviceengine = require('./deviceengine_main');
const Devicemate = require('./devicemate');
const Basedevo = require('./basedevo');

// const loadscenes = require('../scene/loadscenes');
const Scenengine = require('../scene/sceneengine');
const Scenemate = require('../scene/scenemate');

module.exports = async function(holder) {
  holder.global = new Globalman(holder);
  holder.devSet = {};
  holder.dnSet = {};
  holder.sceneSet = {};
  holder.traceSet = {};

  let currentScript = '';
  const callbackMap = {};

  // Эти движки работают в основном процессе
  const engine = new Deviceengine(holder);
  const sceneengine = new Scenengine(holder);

  // Первая загрузка данных на старте - типы, устройства, глобальные переменные, сценарии
  const devStructSet = await load(holder);
  const typeStructMap = getTypeStructMap();
  await loadscenes();

  // Запустить worker. boot=true, при рестартах будет false
  holder.deviceWorker = startWorker(devStructSet, typeStructMap, holder.global.glByDid, holder.sceneSet, true);

  // Устройства  На этой стороне
  //  - отслеживание изменений структуры и атрибутов устр-ва,
  //  - события изменения данных (от каналов, от интерфейсов) и отправка на worker
  for (const did of Object.keys(devStructSet)) {
    const item = devStructSet[did];
    if (item.dn) {
      holder.devSet[item._id] = new Basedevo(item, holder.typeMap);
      holder.dnSet[item.dn] = holder.devSet[item._id]; // Объект устройства для обращения по dn
    } else {
      console.log('WARN: devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }

  const mate = new Devicemate(engine);
  mate.start();
  engine.start(); // Вся оперативная работа - отправка данных для worker по событиям - внутри engine
  console.log('INFO: Device engine has started, devices: ' + Object.keys(holder.devSet).length);

  // Сценарии. На этой стороне - отслеживание изменений сценариев
  // const sceneengine = new Scenengine(holder);
  const scenemate = new Scenemate(sceneengine);
  sceneengine.start();
  scenemate.start();
  console.log('INFO: Scene engine has started, script instances: ' + Object.keys(holder.sceneSet).length);

  // перехват сообщений с callback - для возврата по запросам
  holder.on('getcb:device:raw', (msg, cb) => {
    // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' TO WORKER: ' + util.inspect(msg));
    msg.id = shortid.generate();
    callbackMap[msg.id] = cb;
    holder.deviceWorker.postMessage({ name: 'getcb:device:raw', data: { ...msg } });
  });

  /**
   * Запустить (перезапустить) worker
   * Можно передавать только анемичные объекты (без методов)
   *   worker добавляет методы у себя
   *
   * @param {Object}  devSet - содержит devStructSet, выделенный из devSet
   * @param {Object}  typeMap - содержит typeStructMap, выделенный из typeMap
   * @param {Object}  glSet - содержит holder.global.glByDid
   * @param {Object}  sceneSet - содержит holder.sceneSet
   * @param {Bool}  boot - флаг запуска при старте сервера (1-запуск, 0-перезапуск)
   *
   **/
  function startWorker(devSet, typeMap, glSet, sceneSet, boot) {
    const fullPath = require.resolve('../deviceworker/worker_engines');
    let w = new Worker(fullPath, { workerData: { devSet, typeMap, glSet, sceneSet, boot } });

    w.on('message', msg => {
      if (msg.data && msg.data.id && callbackMap[msg.data.id]) {
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
        // console.log(hut.getDateTimeFor(new Date(), 'shortdtms')+'_WT FROM WORKER: '+util.inspect(msg))
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

  /**
   * Перезапустить worker
   **/
  function restartWorker() {
    if (holder.deviceWorker.threadId > 0) return;
    // Сделать новые слепки и запустить заново
    holder.deviceWorker = startWorker(getDevStructSet(), getTypeStructMap(), holder.global.glByDid, holder.sceneSet);
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

  /**
   * Фиксация имени текущего скрипта и времени запуска/останова
   * Запускается по сообщению 'trace:handler' от worker-а
   * Worker может сам заблокировать скрипт при ошибке (runtime error try-catch)
   *
   * @param {Object} - из сообщения 'trace:handler'
   *
   */
  function tracing(traceObj) {
    const { did, hanid, state, ts, blk, error, sceneId} = traceObj;
    if (!holder.traceSet[hanid]) {
      console.log('ERROR: Not found traceSet with id=' + hanid);
      return;
    }

    if (state) {
      holder.traceSet[hanid].fixStart({ did, ts });
      currentScript = hanid;
    } else {
      holder.traceSet[hanid].fixStop({ did, ts, blk, error: error || '' });
      currentScript = '';
    }

    // Синхронизировать sceneSet
    if (sceneId) sceneengine.receivedTrace(traceObj);
  }

  async function loadscenes() {
    const sceneDocs = (await holder.dm.dbstore.get('scenes')).filter(doc => !doc.folder);
    sceneDocs.forEach(doc => {
      sceneengine.addSceneItem(doc);
    });
  }

  // Отслеживание по таймеру состояния worker-а
  // Если есть handler, работающий более 1 сек - остановить worker (terminate) и блокировать сценарий
  // В следующем цикле, если остановлен - запуск заново с данными из holder (текущий слепок данных)
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
