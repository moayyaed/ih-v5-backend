/**
 * pluginengine.js
 *
 * Запускает плагины как дочерние процессы и выполняет обмен данными с плагинами
 *
 *  1. Старт/стоп/рестарт плагина
 *     В случае зависания плагина останавливает его и перезапускает??
 *
 *  2. Обмен данными с плагинами
 *     - получение данных с каналов, маппинг на устройства
 *     - получение другой информации от плагинов
 *     - отправка команд каналам, предварительно маппинг с устройства?? Или приходит уже в структуре канала?
 *     - отправка другой информации плагинам, в том числе по подписке
 *
 *  3. Таймеры.
 *     - Следит за плагинами (можно выставить таймаут плагина - опционально! )
 *     - Следит за поступлением данных для конкретного устройства (свойства?) (можно выставить таймаут опционально )
 *
 *
 *  4. События:
 *     - генерирует событие "get:device:data" при получении данных от плагина (после маппинга)
 *
 *     - генерирует событие "get:debug:message" при получении отладочных сообщений от плагина?
 *
 *     - генерирует событие " startt:scene", если для канала настроен запуск сценария при поступлении данных??
 *
 *     - слушает события
 *             "send:device:command"  - передать плагину команду для устройства
 *             "send:plugin:command"  - передать команду плагину (не касаемо устройств)
 *             "start:plugin"  - запустить плагин
 *             "stop:plugin"  - остановить плагин (все плагины?)
 *             "set:debug:status" - запустить/остановить отладку
 *             "sendinfo"  - ?
 *             "transferdata_in" - ?
 *             "transferdata_out" - ?
 *
 *       Для обслуживания подписки плагинов слушает
 *             "changed:device:data"  - (от deviceserver) изменение данных уcтройств для передачи по подписке плагинам (один плагин подписывается на другой)
 *             "changed:plugin:status" -  (от pluginserver) изменение состояния плагина (из другого плагина)
 *
 *
 *
 * Флаги плагина:
 *    active: 1-активизирован, 0-нет
 *          При загрузке плагина или добавлении нового экз active=1 если не требуется ввод ключа
 *          Но можно установить active=0, если нужно отключить плагин, но не удалять его
 *          (при удалении плагина все каналы и привязки удаляются)
 *          Для неактивного плагина не выполняется загрузка каналов, построение readMap, writeMap
 *          Первая цель этого флага - механизм ключей для плагина
 *
 *    suspend: 1-приостановлен
 *         Плагин активен, но не запущен
 */

const util = require('util');
const fs = require('fs');
const child = require('child_process');

const appconfig = require('../appconfig');
// const firstStart = require('./firststart');
const pluginmessage = require('./pluginmessage');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');
const Subsman = require('../utils/subscriber');

const Unito = require('./unito');
// const sceneutils = require('./sceneutils');

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.agent = agent;

    this.unitSet = new Map();
    holder.unitSet = this.unitSet;

    this.subsman = new Subsman();

    // Запустить механизм таймеров для интервальных таймеров c мин интервалом 100 мс
    // const tm = new Timerman(0.1);
    //  tm.on('ready', this.onTimerReady);

    //  holder.on('send:device:command', query => {});
    //  holder.on('send:plugin:command', query => {});
    //  holder.on('start:plugin', unitId => {});
    //  holder.on('stop:plugin', unitId => {});

    holder.on('changed:device:data', changed => {
      console.log('PLUGUNEN: changed:device:data ' + util.inspect(changed));
      this.sendOnSub('device', {}, changed);
    });
  }

  start(unitDocs) {
    this.unitSet.clear();

    unitDocs.forEach(uobj => {
      const unitId = uobj._id;
      try {
        this.unitSet[unitId] = new Unito(uobj);
        if (this.unitSet[unitId].active) {
          // Сразу запускать, если status=1
          // При первом запуске проверяется, установлены ли пакеты
          // firstStart.start(uobj._id, startModule, holder);

          this.runModule(unitId);
        }
      } catch (e) {
        this.unitSet[unitId] = '';
        console.log('Plugin ' + uobj._id + 'run error: ' + util.inspect(e));
      }
    });
  }

  /** Запустить модуль как дочерний процесс
   *    @param {string} unit - идентификатор
   */
  runModule(unitId) {
    console.log('RUN ' + unitId);

    if (this.isModuleRunning(unitId)) return;
    const uobj = this.unitSet[unitId];
    if (!uobj) return;

    const modulepath = appconfig.getPluginModulePath(uobj.plugin, uobj.module);
    if (!fs.existsSync(modulepath)) throw { message: 'File not found: ' + modulepath };

    // TODO
    // channels.rebuildReadWriteMap(unitSet[unit], holder);

    // let args = unitSet[unit].getArgs(unit, holder);
    let args = [];
    // holder.logMsg('Run ' + modulepath + ' ' + args.join(' '), 2); // syslog
    // logModuleProtocol(unit, 'IH: Run ' + modulepath + ' ' + args.join(' '), 1); // pluginlog

    // if (unitSet[unit].runMethod == 1) {
    this.forkModule(unitId, modulepath, args);
    // } else {
    //  spawnModule(unit, modulepath, args);
    // }
    /*
    unitSet[unit].starterr = 0;
    unitSet[unit].initOk = 1;
    holder.logMsg('Module has started: ' + modulepath, moduleLogName);

    unitSet[unit].laststart = Date.now();
    unitSet[unit].laststop = 0;

    setStateUnitSensor(unit);
    setUnitSensorError(unit, '');
    */
  }

  forkModule(unitId, modulepath, args) {
    const ps = child.fork(modulepath, args);
    ps.on('message', m => {
      // console.log('PS ' + util.inspect(m));
      this.processMessage(m, unitId); // Здесь происходит все, включая маппинг
    });
    ps.on('close', code => {
      this.moduleOnClose(unitId, code);
    });
    this.unitSet[unitId].ps = ps;
  }

  /** Остановить модуль
   *    @param {string} unit - идентификатор
   */
  /*
  stopModule(unit, callback) {
    subsman.removeSub(unitSet[unit]);
    if (isModuleRunning(unit)) {
      unitSet[unit].ps.kill('SIGTERM');
      unitSet[unit].ps = 0;
      unitSet[unit].sigterm = 1;
      logModuleProtocol(unit, 'IH: Send SIGTERM.', 2);
    }
    if (callback) callback();
  }
  */

  processMessage(m, unitId) {
    if (!this.unitSet[unitId]) return;
    const uobj = this.unitSet[unitId];

    // readTele - преобразование входной строки в объект чисто техническое.
    // Но возможно есть адаптер - тогда ему передается holder
    const mes = uobj.readTele ? uobj.readTele(m, this.holder) : m;
    if (typeof mes != 'object') return;

    let result = '';
    switch (mes.type) {
      case 'data':
        result = this.processData(mes.data, uobj);
        break;

      case 'sub':
        result = this.doSub(mes, unitId);
        break;

      case 'unsub':
        result = this.doUnsub(mes, unitId);
        break;
      default:
        result = pluginmessage(mes, uobj, this.holder);
    }
    if (result) console.log(result);
  }

  processData(data, uobj) {
    if (!data) return;
    const readObj = uobj.readData(data, this.holder); // Если привязок нет - может ничего и не быть!!
    if (readObj) this.holder.emit('get:device:data', readObj);
    return 'IH: get ' + util.inspect(data) + '\nset ' + util.inspect(readObj);
  }

  doSub(mes, unitId) {
    // Сформировать объект подписки:
    const subobj = mes.filter || {};
    this.subsman.addSub(mes.event, unitId, mes.id, subobj);
  }

  doUnsub(mes, unitId) {
    this.subsman.unSub(unitId, mes.id);
  }

  /**
   *
   *  @param {string} unitId - идентификатор
   *  @param {*} code - код завершения
   *  @param {*} errstr
   */
  moduleOnClose(unitId, code, errstr) {
    if (!this.unitSet[unitId]) return;

    if (this.unitSet[unitId].sigterm) {
      this.logModuleProtocol(unitId, 'IH: Plugin exit', 1);
      this.unitSet[unitId].sigterm = 0;
      code = 0;
      // setTxtUnitSensor(unit, '');
    } else {
      this.logModuleProtocol(unitId, 'IH: Plugin exit with code ' + code, 1);

      if (errstr) this.logModuleProtocol(unitId, 'IH: STDERR ' + errstr, 0);
      // setTxtUnitSensor(unit, errstr || code);
    }
    this.unitSet[unitId].ps = '';
    this.unitSet[unitId].ack = 0;
    this.unitSet[unitId].wriTimeout = 0;
    this.unitSet[unitId].toSend = [];
    this.unitSet[unitId].laststop = Date.now();
    // setStateUnitSensor(unit);

    if (!this.unitSet[unitId].suspend && this.unitSet[unitId].restarttime > 0) {
      // debugMsg(unit, 'IH: restart timer ' + unitSet[unit].restarttime);
      // tm.startTimer(unitSet[unit].restarttime, { owner: unit, tname: 'restart' });
    }
  }

  isModuleRunning(unitId) {
    return unitId && this.unitSet[unitId].ps;
  }

  // Отправить по подписке
  sendOnSub(event, paramObj, data) {
    const subArr = this.subsman.getSubs(event, paramObj);

    subArr.forEach(subItem => {
      const unitId = subItem.cid;
      if (this.isModuleRunning(unitId)) {
        // TODO: Также возможно нужно фильтровать data?? с использованием  subItem.subobj.filter
        this.unitSet[unitId].send({ id: subItem.subid, type: 'sub', event, data });
      }
    });
  }

  // Отправить по подписке конкретному плагину
  sendOnUnitSub(event, unitId, paramObj, data) {
    if (!this.isModuleRunning(unitId)) return;

    if (!this.subsman.hasClientSubs(event, unitId) || !data) return;

    const subArr = this.subsman.getClientSubs(event, unitId, paramObj); // Теоретически м б несколько
    subArr.forEach(subItem => {
      // TODO: Также возможно нужно фильтровать data?? с использованием  subItem.subobj.filter
      this.unitSet[unitId].send({ id: subItem.subid, type: 'sub', event, data });
    });
  }

  logModuleProtocol(unitId, txt) {
    if (this.unitSet[unitId]) {
      console.log('Plugin ' + unitId + ' ' + txt);
    }
  }
}
module.exports = Pluginengine;
