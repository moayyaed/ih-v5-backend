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
 *       Для обслуживания подписки создается отдельный модуль, которые слушает
 *             "changed:device:data"  - (от deviceserver) изменение данных уcтройств для передачи по подписке плагинам (один плагин подписывается на другой)
 *             "changed:channels:param" - (от pluginmate) изменение настроек каналов (добавлени, удаление, параметры)
 *             "changed:plugin:param" -  (от pluginmate) изменение параметров плагина
 *             "changed:plugin:status" -  (от pluginserver) изменение состояния плагина (из другого плагина)
 *             "changed:table:xxx" -  (от pluginmate) изменение таблиц (не каналы), на которые подписан плагин
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
const Timerman = require('../utils/timermanager');

const Unito = require('./unito');
// const sceneutils = require('./sceneutils');

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.agent = agent;

    this.unitSet = new Map();
    holder.unitSet = this.unitSet;

    // Запустить механизм таймеров для интервальных таймеров c мин интервалом 100 мс
    const tm = new Timerman(0.1);
    //  tm.on('ready', this.onTimerReady);
  }

  start(unitDocs) {
    // Построить unitSet, канала тоже считаны
    console.log(util.inspect(unitDocs))
    this.unitSet.clear();
    unitDocs.forEach(uobj => {
      const unitId = uobj._id;
      this.unitSet[unitId] = new Unito(uobj);
      if (this.unitSet[unitId].active) {
        // Сразу запускать, если status=1
        // При первом запуске проверяется, установлены ли пакеты
        // firstStart.start(uobj._id, startModule, holder);
        try {
        this.runModule(unitId)
        } catch (e) {
          console.log('Plugin '+unitId+'run error: '+util.inspect(e));
        }
      }
    });
  }

  /** Запустить модуль как дочерний процесс
   *    @param {string} unit - идентификатор
   */
  runModule(unitId) {
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
      console.log('PS '+util.inspect(m));
      this.processMessage(m, unitId); // Здесь происходит все, включая маппинг
    });
    ps.on('close', code => {
      this.moduleOnClose(unitId, code);
    });
    this.unitSet[unitId].ps = ps;
  }

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
        result = this.processData(mes.data, uobj);
        break;
      default:
        result = pluginmessage(mes, uobj, this.holder);
    }
    if (result) console.log(result);
  }

  processData(data, uobj) {
    if (!data) return;

    // uobj.saveRawChannelsValue(data); // сохранить сырое значение с канала
    const readObj = uobj.readData(data, this.holder); // Если привязок нет - может ничего и не быть!!
    if (readObj) this.holder.emit('get:device:data', readObj);
    return 'IH: get ' + util.inspect(data) + '\nset ' + util.inspect(readObj);
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
    return this.unitSet[unitId] && this.unitSet[unitId].ps;
  }

  logModuleProtocol (unitId, txt, level) {
    console.log('Plugin '+unitId+' '+txt);
  }
}
module.exports = Pluginengine;
