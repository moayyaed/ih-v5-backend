/**
 * pluginengine.js
 *
 * Запускает плагины как дочерние процессы (fork, spawn)
 *
 *  1. Старт/стоп/рестарт плагина
 *     Перезапускает плагины, остановившиеся по ошибке
 *     В случае зависания плагина останавливает его и перезапускает??
 *
 *  2. События:
 *     - слушает события
 *             ??"send:device:command"  - передать плагину команду для устройства
 *             ?? "send:plugin:command"  - передать команду плагину (не касаемо устройств)
 *             "start:plugin"  - запустить плагин
 *             "stop:plugin"  - остановить плагин
 *             ??"set:debug:status" - запустить/остановить отладку
 *             ??"sendinfo"  - ?
 *             ??"transferdata_in" - ?
 *             ??"transferdata_out" - ?
 *
 *       Для обслуживания подписки плагинов слушает
 *             "changed:device:data"  - (от deviceserver) изменение данных уcтройств для передачи по подписке плагинам (один плагин подписывается на другой)
 *             ?? dm.on('inserted:') - и другие события таблиц!!?
 *
 * Флаги плагина:
 *    active: 1-активизирован, 0-нет
 *          При загрузке плагина или добавлении нового экз active=1 если не требуется ввод ключа
 *
 *    suspend: 1-приостановлен
 *         Плагин активен, но не запущен
 */

const util = require('util');
const fs = require('fs');
const child = require('child_process');

// const appconfig = require('../appconfig');
// const firstStart = require('./firststart');

const hut = require('../utils/hut');
const deviceutil = require('../device/deviceutil');
const datautil = require('../api/datautil');

const Unito = require('./unito');
const Unitchano = require('./unitchano');
const processmessage = require('./processmessage');

// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const Timerman = require('../utils/timermanager');

const tm = new Timerman(1);

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = holder.dm;
    this.agent = agent;
    this.unitSet = {};

    holder.unitSet = this.unitSet;
    tm.on('ready', this.onTimerReady.bind(this));
  }

  start() {
    this.holder.on('start:plugin', unitId => {
      this.runModule(unitId);
    });

    this.holder.on('stop:plugin', unitId => {
      this.stopModule(unitId);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('plugin_')) {
        this.debugctl(mode, uuid.split('_').pop());
      }
    });

    this.holder.on('changed:device:data', changed => {
      // console.log('PLUGINEN: changed:device:data ' + util.inspect(changed));
      this.sendOnSub('device', {}, changed);
    });

    this.holder.on('send:device:command', query => {
      const { unit, chan, value, command } = query;

      if (!unit) {
        console.log('send:device:command ERROR. Missing unit: ' + util.inspect(query));
        return;
      }
      // unit, did, prop, command, value

      const uobj = this.unitSet[unit];
      if (!uobj) {
        console.log('send:device:command ERROR. Unit ' + unit + ' not activated: ' + util.inspect(query));
        return;
      }
      if (!uobj.chano) {
        console.log('send:device:command ERROR. No chano object! ' + util.inspect(query));
        return;
      }

      const chanObj = uobj.chano.getWriteObj(chan, value);
      if (!chanObj) {
        console.log('send:device:command ERROR. Not found WriteObj: ' + util.inspect(query));
        return;
      }
      if (command) chanObj.command = command;

      // formTele должен сформировать полностью сообщение - это м.б. объект или строка

      /*
      if (!this.unitSet[unit].smart) {
        const m = this.unitSet[unit].formWriteProp({ did, prop, value, command });
        if (!m) {
          console.log('send:device:command ERROR. Empty formWriteProp ' + util.inspect(query));
          return;
        }
        mes = this.unitSet[unit].formTele({ type: 'act', data: [m] }, holder);
      } else {
      */
      const mes = { type: 'act', data: [chanObj] };

      if (mes) {
        console.log(unit + ' IH: send ' + util.inspect(mes));
        this.unitSet[unit].send(mes);
      }
    });

    this.holder.on('finish', () => {
      this.logUnit('system', 'Stop IH system');
      Object.keys(this.unitSet).forEach(unit => {
        if (this.unitSet[unit] && this.unitSet[unit].sendSigterm) {
          this.unitSet[unit].sendSigterm();
        }
      });
    });
  }

  async createUnit(doc) {
    const unitId = doc._id;
    const manifest = await this.dm.getCachedData({ method: 'getmeta', type: 'manifest', id: doc.plugin });
    const uobj = new Unito(doc, manifest);

    // Если плагин использует каналы (посмотреть в манифесте)
    const unitChannels = await this.loadUnitChannels(unitId);
    // Добавить в объект свойства и функции для работы с каналами
    uobj.chano = new Unitchano(doc, unitChannels);

    return uobj;
  }

  addUnit(unitId, unitObj, info) {
    this.unitSet[unitId] = unitObj;
    this.createUnitIndicator(unitId);
    if (info) unitObj.setInfo(info);
   
    // TODO - При первом запуске проверяется, установлены ли пакеты
    // firstStart.start(uobj._id, startModule, holder);
    // if (!this.unitSet[unitId].active) {
    //  errstr = 'Is not active';
    // } else
    if (!this.unitSet[unitId].suspend) {
      this.runModule(unitId);
    } else {
      this.setUnitState(unitId);
    }
  }

  // Создать системный индикатор плагина
  createUnitIndicator(unitId) {
    const dn = deviceutil.getUnitIndicatorId(unitId);
    this.holder.emit('create:unitIndicator', unitId);
    this.unitSet[unitId].dn = dn;
  }

  updateUnit(unitId, doc) {
    if (!this.unitSet[unitId]) return;

    // Изменились параметры - переписать весь doc заново
    this.unitSet[unitId].setDoc(doc);

    // Сделать рестарт плагина?
  }

  removeUnit(unitId) {
    if (!this.unitSet[unitId]) return;

    this.stopModule(unitId);
    this.holder.emit('remove:unitIndicator', unitId);
    delete this.unitSet[unitId];
  }

  /** Запустить модуль как дочерний процесс
   *    @param {string} unitId - идентификатор
   */
  runModule(unitId) {
    if (this.isModuleRunning(unitId)) return;
    const uobj = this.unitSet[unitId];
    if (!uobj) return;
    let errstr = '';
    try {
      const modulepath = uobj.getModulepath();
      if (!fs.existsSync(modulepath)) throw { message: 'File not found: ' + modulepath };

      const args = uobj.getArgs(); // Массив строк!! или пустая строка?
      this.logUnit(unitId, 'IH: Run ' + modulepath + ' ' + args.join(' '), 1); // pluginlog

      // TODO if (unitSet[unit].runMethod == 1) {
      this.forkModule(unitId, modulepath, args);
      // } else {
      //  spawnModule(unit, modulepath, args);
      // }

      this.unitSet[unitId].laststart = Date.now();
      this.unitSet[unitId].laststop = 0;
    } catch (e) {
      this.unitSet[unitId].ps = '';
      errstr = 'Run error: ' + hut.getShortErrStr(e);
    }
    this.setUnitState(unitId, errstr);
  }

  forkModule(unitId, modulepath, args) {
    const uobj = this.unitSet[unitId];
    const ps = child.fork(modulepath, args);
    uobj.ps = ps;

    if (!ps) {
      this.setUnitState(unitId, 'Fork error!');
      return;
    }

    ps.on('close', code => {
      this.moduleOnClose(unitId, code);
    });

    if (uobj.connector) {
      uobj.connector.init(ps);
    } else {
      ps.on('message', async m => {
        const result = await processmessage(m, uobj, this.holder);
        // if (result) this.logUnit(unitId, result, 2);
        if (result) this.debug(unitId, result);
      });
    }
  }

  /** Остановить модуль
   *    @param {string} unit - идентификатор
   */
  stopModule(unit, callback) {
    // subsman.removeSub(unitSet[unit]);
    if (this.isModuleRunning(unit)) {
      this.unitSet[unit].sendSigterm();
      this.logUnit(unit, 'IH: Send SIGTERM.', 2);
    }
    if (callback) callback();
  }

  /**
   *
   *  @param {string} unitId - идентификатор
   *  @param {*} code - код завершения
   */
  moduleOnClose(unitId, code) {
    if (!this.unitSet[unitId]) return;

    const uobj = this.unitSet[unitId];
    let errStr = '';
    if (uobj.sigterm) {
      this.logUnit(unitId, 'IH: Plugin exit after SIGTERM', 1);
      uobj.sigterm = 0;
      uobj.suspend = 1;
    } else {
      this.logUnit(unitId, 'IH: Plugin exit with code ' + code, 1);
      errStr = 'Plugin exit with code ' + code;
      uobj.suspend = 0;
    }
    uobj.ps = '';
    uobj.laststop = Date.now();

    this.setUnitState(unitId, errStr);

    if (!uobj.suspend && uobj.restarttime > 0) {
      // debugMsg(unit, 'IH: restart timer ' + unitSet[unit].restarttime);
      tm.startTimer(uobj.restarttime, { owner: unitId, tname: 'restart' });
    }
  }

  setUnitState(unitId, errStr = '') {
    let state = 1;
    this.unitSet[unitId].error = errStr;

    if (this.unitSet[unitId].ps) {
      state = 2;
    } else if (this.unitSet[unitId].suspend) {
      state = 1;
    } else if (this.unitSet[unitId].error) {
      state = 3;
    }

    this.unitSet[unitId].state = state;
    // Установить значение в устройство - индикатор
    this.holder.emit('received:device:data', { [this.unitSet[unitId].dn]: { state } });
  }

  isModuleRunning(unitId) {
    return unitId && this.unitSet[unitId].ps;
  }

  // TODO Отправить по подписке
  sendOnSub(event, paramObj, data) {
    /*
    const subArr = this.subsman.getSubs(event, paramObj);

    subArr.forEach(subItem => {
      const unitId = subItem.cid;
      if (this.isModuleRunning(unitId)) {
        // TODO: Также возможно нужно фильтровать data?? с использованием  subItem.subobj.filter
        this.unitSet[unitId].send({ id: subItem.subid, type: 'sub', event, data });
      }
    });
    */
    console.log('SEND ON SUB ' + event);
  }

  async loadUnitChannels(unit) {
    return this.dm.dbstore.get('devhard', { unit }); // Массив каналов
  }

  async unitChannelsUpdated(unitId, updatedDocs) {
    const channelArray = await this.loadUnitChannels(unitId);
    if (this.unitSet[unitId]) {
      // channelArray - Полностью считаны все каналы заново для перестройки readMap, writeMap
      this.unitSet[unitId].chano.updateChannels(channelArray);

      // Старые плагины без подписки могут просто перезагружаться при изменении каналов
      if (this.unitSet[unitId].restartOnChannelsChange) {
        this.stopModule(unitId);
      } else {
        // Отправить по подписке - обновление каналов для плагинов
        this.sendOnUnitSub('tableupdated', unitId, { tablename: 'channels' }, updatedDocs);
      }
    }
  }

  // TODO Отправить по подписке конкретному плагину
  sendOnUnitSub(event, unitId, paramObj, data) {
    if (!this.isModuleRunning(unitId)) return;

    // Если плагин подписан на событие
    const uobj = this.unitSet[unitId];
    const subIds = uobj.getSubs(event, paramObj); // TODO - filter
    if (!subIds.length) return;

    // Теоретически м б несколько
    subIds.forEach(subsId => {
      // TODO: Также возможно нужно фильтровать data??
      uobj.send({ id: subsId, type: 'sub', event, data });
    });
  }

  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      let unit = timeobj.owner;
      if (timeobj.tname == 'restart') {
        // Запуск плагина если он не запущен, не остановлен, т е если не suspend
        if (this.unitSet[unit].active && !this.unitSet[unit].suspend && !this.isModuleRunning(unit)) {
          // this.runModule(unit);
        }
      }
    }
  }

  logUnit(unitId, txt, level) {
    this.dm.insertToLog('pluginlog', { unit: unitId, txt, level });
    this.debug(unitId, txt);
  }

  debugctl(mode, unitId) {
    if (!this.unitSet[unitId]) return;

    const uobj = this.unitSet[unitId];
    uobj.debug = mode; // 0 || 1
    if (mode) {
      // Включена подписка - вывести текущее состояние
      this.debug(unitId, datautil.getStatusStr(uobj, 'unitStateList'));
    }
  }

  debug(unitId, msg) {
    if (!this.unitSet[unitId] || !this.unitSet[unitId].debug) return;

    this.holder.emit('debug', 'plugin_' + unitId, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
  }
}
module.exports = Pluginengine;
