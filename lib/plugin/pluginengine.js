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

const hut = require('../utils/hut');
const Timerman = require('../utils/timermanager');
// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const tm = new Timerman(1);

const Subsman = require('../utils/subscriber');

const Unito = require('./unito');
// const sceneutils = require('./sceneutils');

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.agent = agent;

    this.unitSet = {};
    holder.unitSet = this.unitSet;

    this.writeChanMap = new Map();
    holder.writeChanMap = this.writeChanMap;

    this.subsman = new Subsman();

    tm.on('ready', this.onTimerReady.bind(this));

    //  holder.on('send:plugin:command', query => {});

    holder.on('start:plugin', unitId => {
      this.runModule(unitId);
    });
    holder.on('stop:plugin', unitId => {
      this.stopModule(unitId);
    });

    holder.on('changed:device:data', changed => {
      // console.log('PLUGINEN: changed:device:data ' + util.inspect(changed));
      this.sendOnSub('device', {}, changed);
    });

    holder.on('send:device:command', query => {
      const { unit, did, prop, value, command } = query;

      if (!unit) {
        console.log('send:device:command ERROR. Missing unit: ' + util.inspect(query));
        return;
      }
      // unit, did, prop, command, value

      if (!this.unitSet[unit]) {
        console.log('send:device:command ERROR. Unit ' + unit + ' not activated: ' + util.inspect(query));
        return;
      }

      // formTele должен сформировать полностью сообщение - это м.б. объект или строка
      let mes;
      if (!this.unitSet[unit].smart) {
        const m = this.unitSet[unit].formWriteProp({ did, prop, value, command });
        if (!m) {
          console.log('send:device:command ERROR. Empty formWriteProp ' + util.inspect(query));
          return;
        }
        mes = this.unitSet[unit].formTele({ type: 'act', data: [m] }, holder);
      } else {
        mes = { type: 'act', data: query };
      }

      if (mes) {
        console.log(unit + ' IH: send ' + util.inspect(mes));
        this.unitSet[unit].send(mes);
      }
    });
  }

  start(unitDocs) {
    console.log('INFO: Plugin engine has started, units: ' + unitDocs.length);
    unitDocs.forEach(uobj => {
      const unitId = uobj._id;
      try {
        this.unitSet[unitId] = new Unito(uobj);
        this.refreshWriteChanMap(unitId);

        if (this.unitSet[unitId].active) {
          // Сразу запускать, если status=1
          // При первом запуске проверяется, установлены ли пакеты
          // firstStart.start(uobj._id, startModule, holder);

          this.runModule(unitId);
          this.unitSet[unitId].error = '';
        }
      } catch (e) {
        this.unitSet[unitId].ps = '';
        const errstr = 'Plugin run error: ' + hut.getShortErrStr(e);
        this.unitSet[unitId].error = errstr;
        console.log('Plugin ' + uobj._id + 'run error: ' + util.inspect(e));
        this.logUnit(unitId, 'IH: '+ errstr, 1); 
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
    this.logUnit(unitId, 'IH: Run ' + modulepath + ' ' + args.join(' '), 1); // pluginlog

    // if (unitSet[unit].runMethod == 1) {
    this.forkModule(unitId, modulepath, args);
    // } else {
    //  spawnModule(unit, modulepath, args);
    // }

    this.unitSet[unitId].starterr = 0;
    this.unitSet[unitId].initOk = 1;
    // holder.logMsg('Module has started: ' + modulepath, moduleLogName);

    this.unitSet[unitId].laststart = Date.now();
    this.unitSet[unitId].laststop = 0;
    this.unitSet[unitId].error = '';

    // setStateUnitSensor(unit);
    // setUnitSensorError(unit, '');
  }

  refreshWriteChanMap(unitId) {
    for (const [key, unit] of this.writeChanMap) {
      if (unitId == unit) this.writeChanMap.delete(key);
    }
    // Включить из unit.writeMap
    if (!this.unitSet[unitId] || !this.unitSet[unitId].writeMap) return; // Плагин удален

    for (const key of this.unitSet[unitId].writeMap.keys()) {
      this.writeChanMap.set(key, unitId);
    }
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
    console.log('startModule ' + unitId);
  }

  /** Остановить модуль
   *    @param {string} unit - идентификатор
   */
  stopModule(unit, callback) {
    // subsman.removeSub(unitSet[unit]);
    if (this.isModuleRunning(unit)) {
      this.unitSet[unit].ps.kill('SIGTERM');
      this.unitSet[unit].ps = 0;
      this.unitSet[unit].sigterm = 1;
      this.logUnit(unit, 'IH: Send SIGTERM.', 2);
    }
    if (callback) callback();
  }

  async processMessage(m, unitId) {
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
        // ВСЕ ОСТАЛЬНОЕ ОБРАБАТЫВАЕТ pluginmessage
        result = await pluginmessage(mes, uobj, this.holder);
    }
    if (result) console.log(result);
  }

  processData(data, uobj) {
    if (!data) return;
    const readObj = uobj.readData(data, this.holder); // Если привязок нет - может ничего и не быть!!
    if (readObj) this.holder.emit('received:device:data', readObj);
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
   */
  moduleOnClose(unitId, code) {
    if (!this.unitSet[unitId]) return;

    if (this.unitSet[unitId].sigterm) {
      this.logUnit(unitId, 'IH: Plugin exit after SIGTERM', 1);
      this.unitSet[unitId].sigterm = 0;
      code = 0;
      this.unitSet[unitId].error = '';
      // setTxtUnitSensor(unit, '');
    } else {
      this.logUnit(unitId, 'IH: Plugin exit with code ' + code, 1);

      this.unitSet[unitId].error = 'Plugin exit with code ' + code;
      // setTxtUnitSensor(unit, errstr || code);
    }
    this.unitSet[unitId].ps = '';
    this.unitSet[unitId].ack = 0;
    this.unitSet[unitId].wriTimeout = 0;
    this.unitSet[unitId].toSend = [];
    this.unitSet[unitId].laststop = Date.now();
    this.setStatus(unitId);

    // setStateUnitSensor(unit);

    if (!this.unitSet[unitId].suspend && this.unitSet[unitId].restarttime > 0) {
      // debugMsg(unit, 'IH: restart timer ' + unitSet[unit].restarttime);
      tm.startTimer(this.unitSet[unitId].restarttime, { owner: unitId, tname: 'restart' });
    }
  }

  setStatus(unitId) {
    let status;
    if (this.unitSet[unitId].ps) {
      status = 2;
    } else if (!this.unitSet[unitId].active) {
      status = 0;
    } else if (this.unitSet[unitId].suspend) {
      status = 1;
    } else if (this.unitSet[unitId].error) {
      status = 3;
    }

    this.unitSet[unitId].status = status;
    // Установить значение в устройство - индикатор??
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

  unitChannelsUpdated(unit, updatedDocs, channelArray) {
    if (this.unitSet[unit]) {
      // channelArray - Полностью считаны все каналы заново для перестройки readMap, writeMap
      this.unitSet[unit].updateChannels(channelArray);

      // Обновить общий Map каналов для записи - удалить все элементы с unit и добавить заново
      this.refreshWriteChanMap(unit);

      // Старые плагины без подписки могут просто перезагружаться при изменении каналов
      if (this.unitSet[unit].restartOnChannelsChange) {
        this.stopModule(unit);
      } else {
        // Отправить по подписке - обновление каналов для плагинов
        this.sendOnUnitSub('tableupdated', unit, { tablename: 'channels' }, updatedDocs);
      }
    }
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

  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      let unit = timeobj.owner;
      if (timeobj.tname == 'restart') {
        // Запуск плагина если он не запущен, не остановлен, т е если не suspend
        if (this.unitSet[unit].active && !this.unitSet[unit].suspend && !this.isModuleRunning(unit)) {
          this.runModule(unit);
        }
      }
    }
  }

  logUnit(unit, txt, level) {
    this.holder.emit('log', { unit, txt, level }, 'pluginlog');
  }
}
module.exports = Pluginengine;
