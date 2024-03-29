/**
 * pluginengine.js
 *
 * Запускает плагины как дочерние процессы (fork, spawn)
 *
 *  1. Старт/стоп/рестарт плагина
 *     Перезапускает плагины
 *     TODO В случае зависания плагина останавливает его и перезапускает??
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

const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const wu = require('../utils/wrappers');
const deviceutil = require('../device/deviceutil');
const datautil = require('../apptools/datautil');
const logconnector = require('../log/logconnector');

const Unito = require('./unito');
const Unitchano = require('./unitchano');
const processmessage = require('./processmessage');
const Devsubo = require('./devsubo');

// Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
const Timerman = require('../utils/timermanager');

// По расписанию - получаем от scheduler

const tm = new Timerman(1);

class Pluginengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = holder.dm;
    this.agent = agent;
    this.emulmode = appconfig.get('limitLht');
    this.unitSet = {};
    this.onScheduleRestart = {};
    holder.unitSet = this.unitSet;

    this.devsubo = new Devsubo(holder);
    tm.on('ready', this.onTimerReady.bind(this));
  }

  start() {
    // Фиксируем запуск основного процесса
    this.mainProcessState();

    this.holder.on('start:plugin', unitId => {
      this.saveSuspend(unitId, 0);
      this.runModule(unitId);
    });

    this.holder.on('stop:plugin', unitId => {
      this.saveSuspend(unitId, 1);
      this.suspendModule(unitId);
    });

    this.holder.on('deletelog:plugin', unitId => {
      logconnector.deleteLog('pluginlog', { where: [{ name: 'unit', val: unitId }] });
    });

    this.holder.on('scan:plugin', (unitId, params) => {
      // От интерфейса на плагин - процесс сканирования
      this.scanPlugin(unitId, params);
    });

    this.holder.on('log:plugin', (unitId, { txt, level }) => {
      this.logUnit(unitId, txt, level);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('plugin_')) {
        this.debugctl(mode, uuid.split('_').pop());
      }
    });

    this.holder.on('scheduler', timername => {
      if (!this.onScheduleRestart[timername]) return;
      for (const unit of this.onScheduleRestart[timername]) {
        // Перезагрузка плагинов по расписанию
      }
    });

    this.holder.on('sendinfo', (unitId, data) => {
      if (!this.isModuleRunning(unitId)) {
        console.log('WARN: sendinfo ' + unitId + '. Плагин не запущен!');
        return;
      }

      const uobj = this.unitSet[unitId];
      uobj.send({ id: '_', type: 'sub', event: 'sendinfo', data });
    });

    // Отправка на плагин - через девайс (worker) или напрямую (testValue)
    this.holder.on('send:device:command', query => {
      if (this.emulmode) return;

      // console.log('send:device:command query=' + util.inspect(query));

      const { unit, value, testValue, _id } = query;
      try {
        if (!unit) throw { message: 'Missing unit!' };
        const uobj = this.unitSet[unit];
        if (!uobj) throw { message: ' Unit ' + unit + ' not activated!' };
        if (!uobj.chano) throw { message: 'No chano object!' };

        let chanObj;
        /*
        if (_id) { // Передали _id записи в devhard - тестовая записи
          chanObj = uobj.chano.findChannelByRecordId(_id);
          chanObj.value = testValue != undefined ? testValue : value;
          chanObj.id = chanObj.chanId;
        } else if (chanId) {
          chanObj = uobj.chano.getWriteObj(chanId, value);
          console.log('chanObj='+util.inspect(chanObj))

        } else throw {message:'Expected _id or chanId!'}
        */

        if (_id) {
          // Передали _id записи в devhard - тестовая записи
          chanObj = uobj.chano.findChannelByRecordId(_id);
        }

        if (testValue != undefined) {
          chanObj.value = testValue;
          chanObj.id = chanObj.chanId;
        } else {
          // Преобразовать значение по формуле
          chanObj = uobj.chano.getWriteObj(chanObj.chanId, value);
        }

        if (!chanObj) throw { message: 'Not found WriteObj!' };

        // Здесь нужно использовать функцию-адаптер, если она есть?
        const mes = { type: 'act', data: [uobj.writeTele(chanObj)] };
        this.unitSet[unit].send(mes);
      } catch (e) {
        console.log('ERROR: send:device:command ' + e.message + util.inspect(query));
      }

      /*
      const { unit, chan, value, command, testValue } = query;
      console.log('INFO: PLUGIN send:device:command query '+util.inspect(query)+' this.emulmode='+this.emulmode)
      if (this.emulmode) return;

      if (!unit) {
        console.log('WARN: send:device:command ERROR. Missing unit: ' + util.inspect(query));
        return;
      }
      // unit, did, prop, command, value

      const uobj = this.unitSet[unit];
      if (!uobj) {
        console.log('WARN: send:device:command ERROR. Unit ' + unit + ' not activated: ' + util.inspect(query));
        return;
      }
      if (!uobj.chano) {
        console.log('WARN: send:device:command ERROR. No chano object! ' + util.inspect(query));
        return;
      }

      const chanObj = uobj.chano.getWriteObj(chan, value, testValue);
      if (!chanObj) {
        console.log('WARN: send:device:command ERROR. Not found WriteObj: ' + util.inspect(query));
        return;
      }

      if (command) chanObj.command = command;
      chanObj.dn = chan;

      // Здесь нужно использовать функцию-адаптер, если она есть
      const mes = { type: 'act', data: [uobj.writeTele(chanObj)] };

      if (mes) {
        this.unitSet[unit].send(mes);
      }
      */
    });

    // Отправка команды на плагин напрямую (от сценария или интерфейса).
    this.holder.on('send:plugin:command', pobj => {
      if (!pobj) return;
      if (!pobj.type && pobj.command) pobj.type = 'command';
      /*

      let unit = pobj.unit;
      try {
        if (!unit || !this.unitSet[unit]) throw { message: 'Not found unit ' + unit };

        // Отправить команду плагину - если он активен!!?
        if (this.isModuleRunning(unit)) {
          debugMsg(unit, 'IH: plugin command ' + util.inspect(pobj));
          this.unitSet[unit].send(pobj);
        } else {
          debugMsg(unit, 'IH: command fail! ' + util.inspect(pobj) + ' Plugin is not running!');
          callback({ message: 'Plugin ' + unit + ' is not running!' });
        }
      } catch (e) {
        pobj.message = e.message;
        pobj.response = 0;
        this.receiveCommandResponse(pobj);
      }
      */
    });

    this.holder.on('finish', () => {
      this.logUnit('system', 'Stop server');
      Object.keys(this.unitSet).forEach(unit => {
        if (this.unitSet[unit] && this.unitSet[unit].sendSigterm) {
          if (unit != 'p2p') this.unitSet[unit].sendSigterm();
        }
      });
    });

    this.holder.on('emulmode', () => {
      this.emulmode = appconfig.get('limitLht');
      // console.log('WARN: Pluginengine ON emulmode= ' + this.emulmode);
    });

    // Данные от клиента на плагин
    this.holder.on('transferdata_in', mes => {
      const { uuid, unit, payload, method } = mes;
      if (!uuid || !unit) return;

      // Отправить команду плагину - если он активен!!?
      if (this.isModuleRunning(unit)) {
        this.unitSet[unit].send({ type: 'transferdata', id: uuid, uuid, payload, method });
        // Ответ от плагина не ждем
      } else {
        this.debug(unit, 'IH: transferdata_in failed! Plugin ' + unit + ' is not running!');
      }
    });
  }

  // Обработка ответа от плагина на запрос type:command (pluginCommand от сценария или от интерфейса)
  receiveCommandResponse(mes) {
    let result = '';
    try {
      // Отправить клиенту clid
      if (mes.clid && mes.send && util.isArray(mes.send)) {
        this.holder.emit('sendclid', mes.clid, mes.send);
        return 'IH:  Received response for command. Send to client ' + mes.clid + ' ' + util.inspect(mes.send);
      }

      // ИЛИ НА Worker - сценарию??
      if (mes.sender && mes.sender.startsWith('scen')) {
        this.holder.deviceWorker.postMessage({ name: 'response:plugin:command', data: { ...mes } });
        return 'IH:  Received response for command. Send to woker ' + util.inspect(mes);
      }
    } catch (e) {
      result = e.message;
    }
    return 'IH: Received response for command ' + mes.command + ' ' + result;
  }

  mainProcessState() {
    const id = '__UNIT_mainprocess';
    tm.startTimer(10, { owner: 'mainprocess', tname: 'mainprocess' });
    this.holder.emit('received:device:data', { [id]: { state: 1, ...mainProcessInfo() } });
  }

  async createUnit(doc) {
    const unitId = doc._id;

    // const manifest = await this.dm.getCachedData({ method: 'getmeta', type: 'manifest', id: doc.plugin });
    const manifest = await this.dm.getManifest(doc.plugin, true);

    const uobj = new Unito(doc, manifest);

    // Если это интеграция - включить в список интеграций
    // TODO - Если сервис информирования
    if (manifest && manifest.service && manifest.service == 'integration') {
      this.holder.dm.createICollections(unitId);
      datautil.addIntegrationToList(unitId, manifest);
      uobj.integration = 1;
    }

    const info = await this.dm.getPluginInfo(doc.plugin);
    uobj.setInfo(info);

    try {
      await wu.installNodeModulesP(appconfig.getThePluginPath(uobj.plugin));
    } catch (e) {
      console.log('ERROR: Npm install error: ' + util.inspect(e));
    }

    // Если плагин использует каналы (посмотреть в манифесте???)

    const unitChannels = await this.loadUnitChannels(unitId);
    // Добавить в объект свойства и функции для работы с каналами
    uobj.chano = new Unitchano(doc, unitChannels, this.getChannelOptionsFromManifest(manifest));

    return uobj;
  }

  getChannelOptionsFromManifest(manifest) {
    return manifest
      ? {
          smart: manifest.smart || 0,
          innerId: manifest.innerId || 0,
          action_props: manifest.action_props || '',
          share_node_folder_fields: manifest.share_node_folder_fields || ''
        }
      : {};
  }

  addUnit(unitId, unitObj) {
    this.unitSet[unitId] = unitObj;
    this.createUnitIndicator(unitId);

    // Обработать параметр перезагрузки по расписанию

    if (!this.unitSet[unitId].suspend) {
      this.runModule(unitId);
    } else {
      this.setUnitState(unitId);
    }
  }

  // Создать системный индикатор плагина млм dbagent-a
  createUnitIndicator(unitId) {
    const unitObj = this.unitSet[unitId];
    if (!unitObj) {
      console.log('WARN: createUnitIndicator. Not found item in unitSet: ' + unitId);
      return;
    }
    const id = unitObj.dbagent ? 'dbagent' : unitId;
    const dn = deviceutil.getUnitIndicatorId(id); //

    const version = unitObj.info ? unitObj.info.version || '' : '';
    const parent = unitObj.info ? unitObj.info.id || '' : '';
    this.holder.emit('create:unitIndicator', id, { parent, version }); // _id = dn = "__UNIT_dbagent"
    this.unitSet[unitId].dn = dn;
  }

  updateUnit(unitId, doc) {
    if (!this.unitSet[unitId]) return;

    // Изменились параметры - переписать весь doc заново
    this.unitSet[unitId].setDoc(doc);

    // Обработать параметр перезагрузки по расписанию

    // Сделать рестарт плагина?
  }

  saveSuspend(unitId, suspend) {
    if (!this.unitSet[unitId]) return;
    if (this.unitSet[unitId].suspend == suspend) return;

    // dbagent и системные плагины не хранятся в units - их писать не надо
    // НЕТ! Нужно записывать чтобы сохранять между перезапусками!!
    // if (this.unitSet[unitId].sys) return;

    if (this.unitSet[unitId].sys) {
      this.dm.dbstore.update('sysunits', { _id: unitId }, { $set: { suspend } }, { multi: false, upsert: true });
    } else {
      // Пишу напрямую, чтобы не срабатывал updated:units
      this.dm.dbstore.update('units', { _id: unitId }, { $set: { suspend } });
    }
  }

  removeUnit(unitId) {
    if (!this.unitSet[unitId]) return;

    this.stopModule(unitId);
    if (this.unitSet[unitId].integration) {
      datautil.removeIntegrationFromList(unitId);
    }

    this.holder.emit('remove:unitIndicator', unitId);
    delete this.unitSet[unitId];
  }

  /** Запустить модуль как дочерний процесс
   *    @param {string} unitId - идентификатор
   */
  async runModule(unitId) {
    if (!this.unitSet[unitId]) return;

    const uobj = this.unitSet[unitId];
    uobj.suspend = 0;
    uobj.sigterm = 0;
    if (this.isModuleRunning(unitId)) return;

    if (uobj.plugin) {
      if (!appconfig.isThePluginInstalled(uobj.plugin)) {
        this.setUnitState(unitId, 'Plugin is not installed!');
        return;
      }

      // обновить манифест
      const manifest = await this.dm.getManifest(uobj.plugin, true);
      uobj.setManifest(manifest);
    }

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
    let ps;
    if (unitId == 'p2p') {
      ps = child.fork(modulepath, args, { execArgv: ['--expose-gc'] });
    } else {
      ps = child.fork(modulepath, args);
    }

    uobj.ps = ps;
    if (!ps) {
      this.setUnitState(unitId, 'Fork error!');
      return;
    }

    ps.on('close', code => {
      this.moduleOnClose(unitId, code);
    });

    if (uobj.connector) {
      // Если есть connector - сообщения слушает он!
      uobj.connector.start(ps, unitId, this.holder);
      if (uobj.dbagent) this.logUnit('dbagent', appconfig.getMessage('Dbagent') + ' ' + unitId);
    } else {
      ps.on('message', async m => {
        this.processmessageFromUnit(m, unitId);
      });
    }
  }

  async processmessageFromUnit(m, unitId) {
    // console.log('processmessageFromUnit '+unitId+util.inspect(m))
    if (!m || !unitId) return;

    let result;
    switch (m.type) {
      case 'transferdata':
        this.holder.emit('transferdata_out', Object.assign({ unit: unitId }, m));
        break;

      case 'sub':
        this.doSub(unitId, m);
        break;

      case 'unsub':
        this.doUnsub(unitId, m);
        break;

      case 'scan':
        this.emitScan(unitId, m);
        break;

      case 'debug':
        this.debug(unitId, m.txt);
        break;

      case 'exit':
        if (m.error) this.unitSet[unitId].exitError = m.error;
        break;

      case 'command':
        if (m.response != undefined) {
          result = this.receiveCommandResponse(m);
        } else {
          result = await processmessage(m, this.unitSet[unitId], this.holder);
        }
        if (result) this.debug(unitId, result);
        break;

      default:
        result = await processmessage(m, this.unitSet[unitId], this.holder);
        if (result) this.debug(unitId, result);
    }
  }

  doSub(unitId, m) {
    const uobj = this.unitSet[unitId];
    if (!uobj) return;
    if (m.event == 'devices') {
      this.devsubo.doSub(unitId, m);
    } else if (m.id) uobj.subs.set(m.id, m);
  }

  doUnsub(unitId, m) {
    const uobj = this.unitSet[unitId];
    if (!uobj) return;

    if (!m) {
      this.devsubo.doUnsub(unitId);
      if (uobj.subs) uobj.subs.clear();
      return;
    }

    if (m.event == 'devices') {
      this.devsubo.doUnsub(unitId, m);
    } else if (m.id && uobj.subs.has(m.id)) uobj.subs.delete(m.id);
  }

  emitScan(unitId, m) {
    const uobj = this.unitSet[unitId];
    // Получено сообщение по сканированию от плагина - передать одному или всем подписчикам
    // type:'scan', op:'list', data
    // type:'scan', op:'alert', message
    if (m.uuid) {
      this.holder.emit('scan', Object.assign({ unit: unitId }, m));
    } else if (m.scanid) {
      if (uobj.scanSet && uobj.scanSet[m.scanid] && uobj.scanSet[m.scanid].size) {
        uobj.scanSet[m.scanid].forEach(uuid => {
          this.holder.emit('scan', Object.assign({ unit: unitId, uuid }, m));
        });
      }
    }
  }

  suspendModule(unit) {
    if (!this.unitSet[unit]) return;
    this.unitSet[unit].suspend = 1;
    this.stopModule(unit);
  }

  /** Остановить модуль
   *    @param {string} unit - идентификатор
   */
  stopModule(unit, callback) {
    if (!this.unitSet[unit]) return;

    this.doUnsub(unit);
    // console.log('stopModule ' + unit + ' ');

    //
    const uobj = this.unitSet[unit];
    uobj.sendSigterm();
    if (this.isModuleRunning(unit)) {
      this.logUnit(unit, 'IH: Send SIGTERM.', 2);
    }

    if (uobj.connector) {
      uobj.connector.stop();
      if (uobj.dbagent) {
        this.logUnit(
          'dbagent',
          appconfig.getMessage('Dbagent') + ' ' + unit + '. ' + appconfig.getMessage('Suspended')
        );
      }
    } else if (uobj.suspend) {
      this.logUnit(unit, 'IH: Suspend plugin');
    }
    // }
    if (callback) callback();
  }

  /**
   *
   *  @param {string} unitId - идентификатор
   *  @param {*} code - код завершения
   */
  moduleOnClose(unitId, code) {
    // console.log('moduleOnClose this.unitSet[unitId].scanSet='+util.inspect(this.unitSet[unitId].scanSet))
    if (!this.unitSet[unitId]) return;

    if (this.unitSet[unitId].scanSet) {
      this.resetScan(unitId);
    }

    const uobj = this.unitSet[unitId];
    let errStr = '';
    if (uobj.sigterm) {
      this.logUnit(unitId, 'IH: Plugin exit after SIGTERM', 1);
    } else {
      if (uobj.exitError || code > 0) {
        errStr = uobj.exitError ? hut.getShortErrStr(uobj.exitError) : appconfig.getMessage('withCode_') + code;
      }
      uobj.exitError = '';
      this.logUnit(unitId, 'IH: Plugin exit ' + errStr, 1);
    }
    uobj.sigterm = 0;
    uobj.ps = '';
    uobj.laststop = Date.now();

    this.setUnitState(unitId, errStr);
    if (uobj.suspend) {
      this.logUnit(unitId, 'IH: Plugin suspended', 0);
      return;
    }

    if (uobj.getProp) {
      const restarttime = parseInt(uobj.getProp('restarttime'), 10);
      if (!uobj.suspend && restarttime > 0) {
        tm.startTimer(restarttime, { owner: unitId, tname: 'restart' });
      }
    }
  }

  resetScan(unitId) {
    if (!this.unitSet[unitId] || !this.unitSet[unitId].scanSet) return;

    const scanSet = this.unitSet[unitId].scanSet;
    Object.keys(scanSet).forEach(scanid => {
      // { uuid: data.uuid, type:'scan', scanid:'root', op:'alert', variant: 'error', message
      this.emitScan(unitId, { scanid, type: 'scan', op: 'alert', variant: 'warning', message: 'Plugin has stopped!' });
    });
    this.unitSet[unitId].scanSet = {};
  }

  setUnitState(unitId, errStr = '') {
    let state = 4; // Просто остановлен

    this.unitSet[unitId].error = errStr;
    let propObj = {};
    if (this.unitSet[unitId].ps) {
      state = 1;
    } else if (this.unitSet[unitId].suspend) {
      state = 2;
    } else if (this.unitSet[unitId].error) {
      state = 3;
    }
    if (state != 1) propObj = { memrss: 0, memheap: 0, memhuse: 0, status: '' };
    this.unitSet[unitId].state = state;

    // Установить значение в устройство - индикатор
    this.holder.emit('received:device:data', { [this.unitSet[unitId].dn]: { state, ...propObj } });
  }

  isModuleRunning(unitId) {
    return unitId && this.unitSet[unitId] && this.unitSet[unitId].ps;
  }

  async loadUnitChannels(unit) {
    return this.dm.dbstore.get('devhard', { unit }); // Массив каналов
  }

  async unitChannelsUpdated(unitId, updatedDocs, op) {
    // console.log('unitChannelsUpdated ' + unitId + ' updatedDocs=' + util.inspect(updatedDocs));
    const channelArray = await this.loadUnitChannels(unitId);
    if (this.unitSet[unitId]) {
      // channelArray - Полностью считаны все каналы заново для перестройки readMap, writeMap
      this.unitSet[unitId].chano.updateChannels(channelArray);

      // Старые плагины без подписки могут просто перезагружаться при изменении каналов

      if (this.unitSet[unitId].getManifestProp('restartOnChannelsChange')) {
        this.logUnit(unitId, 'IH: Channels has been updated, restartOnChannelsChange', 1);
        this.stopModule(unitId);
      } else {
        this.sendOnUnitSub('tableupdated', unitId, { tablename: 'channels', op }, updatedDocs);
      }
    }
  }

  // TODO Отправить по подписке конкретному плагину
  sendOnUnitSub(event, unitId, paramObj, data) {
    if (!this.isModuleRunning(unitId)) return;

    // Если плагин подписан на событие
    const uobj = this.unitSet[unitId];
    const subIds = uobj.getSubs(event, paramObj); // TODO - filter
    // console.log('sendOnUnitSub ' + unitId + ' subIds=' + util.inspect(subIds));
    if (!subIds.length) return;

    // Теоретически м б несколько подписок
    subIds.forEach(subsId => {
      // TODO: Также возможно нужно фильтровать data??
      // console.log('SEND ON SUB '+util.inspect({ id: subsId, type: 'sub', event, data }))
      uobj.send({ id: subsId, type: 'sub', event, data });
    });
  }

  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      let unit = timeobj.owner;
      if (unit == 'mainprocess') return this.mainProcessState();
      if (!this.unitSet[unit]) return; // Могли удалить плагин

      if (timeobj.tname == 'restart') {
        // Запуск плагина если он не запущен, не остановлен, т е если не suspend  И нет фатальной ошибки??
        // if (this.unitSet[unit].active && !this.unitSet[unit].suspend && !this.isModuleRunning(unit)) {
        if (!this.unitSet[unit].suspend && !this.isModuleRunning(unit)) {
          this.runModule(unit);
        }
      }
    }
  }

  logUnit(unitId, txt, level = 0) {
    logconnector.addLog('pluginlog', { unit: unitId, txt, level });
    this.debug(unitId, txt);
  }

  debugctl(mode, unitId) {
    if (!this.unitSet[unitId]) return;

    const uobj = this.unitSet[unitId];
    uobj.debug = mode; // 0 || 1

    // Отправить плагину в любом случае.
    // wsserver передает флаг=1 при каждой подписке (даже если вкл), а 0 - только если больше нет подписок
    this.unitSet[unitId].send({ type: 'debug', mode: mode ? 'on' : 'off' });
    if (mode) {
      // Включена подписка - вывести текущее состояние
      this.debug(unitId, datautil.getStatusStr(uobj, 'unitStateList'));
    }
  }

  debug(unitId, msg) {
    if (!this.unitSet[unitId] || !this.unitSet[unitId].debug || !msg) return;
    if (typeof msg == 'object') msg = util.inspect(msg);
    if (msg && msg.indexOf('ERROR') >= 0) msg = hut.getShortErrStr(msg);
    this.holder.emit('debug', 'plugin_' + unitId, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
  }

  /**
   * Процедура сканирования - получено сообщение (от интерфейса) на плагин
   *  Может быть отправлен ответ на интерфейс this.holder.emit('scan'
   *  Может быть отправлено сообщение плагину unit.send({ ...params, type: 'scan'
   *
   *
   * @param {String} unitId
   * @param {Object} params
   *         start:1 - запустить сканирование
   *         nodeid:<id узла в дереве> - опционально, если результат записывается в дерево
   *
   *         stop:1 - остановить сканирование
   *
   */
  scanPlugin(unitId, params) {
    if (!this.canScan(unitId, params)) return;

    if (params.stop) {
      this.getStopScan(unitId, params);
      return;
    }

    // { method:'scandata', uuid, params{unit} }
    if (params.method == 'scandata') {
      this.unitSet[unitId].send({ ...params, type: 'scan' });
      return;
    }

    // При подписке нужно вернуть структуру таблицы для каналов - нужно взять ее от плагина!!
    const data = {
      columns: [
        { prop: 'topic', title: '', type: 'text', width: 200 },
        { prop: 'chan', title: 'Channel', type: 'input', width: 200 }
      ]
    };

    this.holder.emit('scan', { uuid: params.uuid, unit: unitId, op: 'meta', data });

    // Если идем от узла - нужно передать параметры узла

    let unitchanItem = {};
    if (params.nodeid) {
      unitchanItem = this.unitSet[unitId].chano.findChannelByRecordId(params.nodeid);
      if (unitchanItem && !unitchanItem.r) unitchanItem = ''; // Если не канал
    }

    const scanid = 'root'; // ?????
    unitchanItem.scanid = scanid; // ?????
    if (params.start) {
      if (!this.unitSet[unitId].scanSet) this.unitSet[unitId].scanSet = {};
      if (!this.unitSet[unitId].scanSet[scanid]) this.unitSet[unitId].scanSet[scanid] = new Set();
      this.unitSet[unitId].scanSet[scanid].add(params.uuid);
      this.debug(unitId, 'Add scanSet ' + util.inspect(params));
    }

    this.unitSet[unitId].send({ ...params, type: 'scan', ...unitchanItem });
  }

  // Проверка возможности сканирования
  canScan(unitId, params) {
    let err = '';
    const pluginStr = appconfig.getMessage('Plugin') + ' ' + unitId + ' ';
    if (!this.unitSet[unitId]) {
      err = pluginStr + appconfig.getMessage('NotFound');
    } else if (!this.isModuleRunning(unitId)) {
      err = pluginStr + appconfig.getMessage('NotRunning');
    } else if (!params) {
      err = appconfig.getMessage('NoOptionsToScan');
    }
    if (!err) return true;

    // Отправка на интерфейс клиенту, который запросил, что не получится
    this.holder.emit('scan', { uuid: params.uuid, unit: unitId, err });
  }

  // От клиента получен stop сканирования
  // Если это последний клиент - отправить на плагин команду на остановку сканирования
  // TODO Если клиент отключился без отправки команды стоп?
  // TODO Если плагин остановлен - всем клиентам нужно отправить сообщение, что плагин встал?
  getStopScan(unitId, params) {
    const uuid = params.uuid;
    // this.debug(unitId, 'Get Stop Scan ' + uuid + ' scanSet=' + util.inspect(this.unitSet[unitId].scanSet));
    // Ищем uuid в scanSet
    if (this.unitSet[unitId].scanSet && typeof this.unitSet[unitId].scanSet == 'object') {
      const scanSet = this.unitSet[unitId].scanSet;
      Object.keys(scanSet).forEach(scanid => {
        if (scanSet[scanid] && scanSet[scanid].has(uuid)) {
          scanSet[scanid].delete(uuid);
          this.debug(unitId, 'Stop scan for ' + uuid + '. Now active clients number: ' + scanSet[scanid].size);
          if (!scanSet[scanid].size) {
            this.unitSet[unitId].send({ type: 'scan', stop: 1, scanid });
            this.debug(unitId, 'Send STOP SCAN to plugin ');
          }
        }
      });
    }
  }
}
module.exports = Pluginengine;

function mainProcessInfo() {
  const mu = process.memoryUsage();
  const memrss = Math.floor(mu.rss / 1024);
  const memheap = Math.floor(mu.heapTotal / 1024);
  const memhuse = Math.floor(mu.heapUsed / 1024);
  return { memrss, memheap, memhuse };
}


// Начиная с версии 5.7.0(beta) добавлен метод сценариев
// this.getSysTime('sunrise','tomorrow');