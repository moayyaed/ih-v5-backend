/**
 * pluginserver.js
 *
 * Запускает плагины как дочерние процессы и выполняет обмен данными с плагинами
 *
 *  1. Старт/стоп/рестарт плагина
 *     В случае зависания плагина останавливает его и перезапускает??
 *  2. Обмен данными с плагинами
 *     - получение данных с каналов
 *     - получение другой информации от плагинов
 *     - отправка команд каналам
 *     - отправка другой информации плагинам, в том числе по подписке
 *  3. События:
 *     - генерирует событие "debug"
 *     - слушает события
 *             "data" - изменение данных утройств
 *             "plugincommand"
 *             "transferdata"
 *             "unitcommand"
 *             "directunitcommand"
 *             "unitsEdited"
 *             "restartUnit"
 *             "channelsEdited"
 *             "reloadPlugin"
 *             "devicetimer"
 *             "sendinfo"
 *             "tableupdated"
 *             "debugctrl"
 *             "stopchilds"
 *             "finish"
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
const child = require('child_process');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const timerman = require('../utils/timermanager');
const dbstore = require('../dbs/dbstore');

const unito = require('./unito');
const firstStart = require('./firststart');
const subsmanager = require('./subsmanager');
const pluginmessage = require('./pluginmessage');

/*
const up = require('../utils/updateutils');
const channels = require('./channels');
const Filelogger = require('../utils/filelogger');
*/

const moduleLogName = 'PluginServer';
const unitSet = {}; // Подключенные экземпляры всех плагинов - объекты  unito

exports.start = function(holder) {
  const pluginspath = appconfig.get('pluginspath');

  // Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
  const tm = new timerman.Timerman(1);
  tm.on('ready', onTimerReady);

  // Объект, реализующий механизм подписки для плагинов
  const subsman = new subsmanager.Subsman();

  // Запустить плагины. Проверка и обновление плагина выполняется в holder (checkPlugin -> updatePluginP)
  dbstore.get('units', {}, {}).forEach(item => createAndRunUnit(item));

  // Сформировать таймеры устройств, у которых установлен timeout
  startDeviceTimeoutTimers();

  // **********   ЗАПУСК И ОСТАНОВ ПЛАГИНОВ

  /**
   * Создать объект unit и запустить модуль как дочерний процесс
   *     @param {object} item - свойства из файла units
   */
  function createAndRunUnit(item) {
    if (!item.id) return;

    let id = item.id;
    try {
      unitSet[id] = new unito.Unit(item);

      // Создать системное устройство и установить его состояние, даже если не получилось запустить плагин
      // Возможно, устройство уже существует - тогда просто возвращается dn
      unitSet[id].dn = holder.addUnitSensor(item);
      setStateUnitSensor(id);

      if (!unitSet[id].active) {
        logModuleProtocol(id, 'IH: Not active.', 0);
        return;
      }

      // При первом запуске проверяется, установлены ли пакеты
      firstStart.start(unitSet[id], startModule, holder);
    } catch (e) {
      holder.logErr(`Plugin ${item.plugin} create error: ${util.inspect(e)}`, moduleLogName);
      logModuleProtocol(id, 'IH: ' + e.message, 0);

      setUnitSensorError(id, getErrTxt(e));
    }
  }

  function startModule(unit, callback) {
    if (!unit || !unitSet[unit]) return;

    let reset = unitSet[unit].initOK ? 0 : 1;

    if (unitSet[unit].initproc && reset) {
      unitSet[unit].initproc(unitSet[unit], holder, err => {
        if (!err) {
          runModule(unit);
        } else {
          unitSet[unit].starterr = err;
          setUnitSensorError(unit, getErrTxt(err));
        }
        if (callback) callback(err);
      });
    } else {
      let err;
      try {
        runModule(unit);
      } catch (e) {
        logModuleProtocol(unit, 'IH: Run error. ' + e.message, 2);
        setUnitSensorError(unit, e.message);
        err = e;
      }
      if (callback) callback(err);
    }
  }

  function isModuleRunning(unit) {
    return unit && unitSet[unit] && unitSet[unit].ps;
  }

  /** Запустить модуль как дочерний процесс
   *    @param {string} unit - идентификатор
   */
  function runModule(unit) {
    if (isModuleRunning(unit)) {
      holder.logMsg('runModule ERROR. Module is running already:' + unit, 2, moduleLogName);
      return;
    }

    unitSet[unit].starterr = 10;
    let modulepath = `${pluginspath}/${unitSet[unit].plugin}/${unitSet[unit].module}`;

    if (!fs.existsSync(modulepath)) throw { message: 'File not found: ' + modulepath };

    // TODO
    // channels.rebuildReadWriteMap(unitSet[unit], holder);

    let args = unitSet[unit].getArgs(unit, holder);
    holder.logMsg('Run ' + modulepath + ' ' + args.join(' '), 2); // syslog
    logModuleProtocol(unit, 'IH: Run ' + modulepath + ' ' + args.join(' '), 1); // pluginlog

    if (unitSet[unit].runMethod == 1) {
      forkModule(unit, modulepath, args);
    } else {
      spawnModule(unit, modulepath, args);
    }
    unitSet[unit].starterr = 0;
    unitSet[unit].initOk = 1;
    holder.logMsg('Module has started: ' + modulepath, moduleLogName);

    unitSet[unit].laststart = Date.now();
    unitSet[unit].laststop = 0;

    setStateUnitSensor(unit);
    setUnitSensorError(unit, '');
  }

  /**
   *    @param {string} unit - идентификатор
   **/
  function forkModule(unit, modulepath, args) {
    const ps = child.fork(modulepath, args);
    ps.on('message', m => {
      processMessage(unitSet[unit].readTele(m, unitSet[unit].readMap, holder), unit);
    });
    ps.on('close', code => {
      moduleOnClose(unit, code);
    });
    unitSet[unit].ps = ps;
  }

  /**
   *    @param {string} unit - идентификатор
   **/
  function spawnModule(unit, modulepath, args) {
    let ps = child.spawn(modulepath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: pluginspath,
      env: unitSet[unit].env
    });
   
    // Ошибки
    ps.stderr.setEncoding('utf8');
    ps.stderr.on('data', errstr => {
      logModuleProtocol(unit, 'IH: ' + errstr, 0);
      setUnitSensorError(unit, errstr);
    });

    // Получение данных
    ps.stdout.on('data', data => {
      if (!data) return;

      const str = String(data);
      debugMsg(unit, 'IH: raw ' + str);
      str.split('\n').filter(line => hut.allTrim(line)).forEach(line => {
        processMessage(unitSet[unit].readTele(line, unitSet[unit].readMap, holder), unit);
      });
    });

    ps.on('close', code => {
      moduleOnClose(unit, code);
    });
    unitSet[unit].ps = ps;
  }

  /**
   *
   *  @param {string} unit - идентификатор
   *  @param {*} code - код завершения
   *  @param {*} errstr
   */
  function moduleOnClose(unit, code, errstr) {
    if (!unitSet[unit]) return;

    if (unitSet[unit].sigterm) {
      logModuleProtocol(unit, 'IH: Plugin exit', 1);
      unitSet[unit].sigterm = 0;
      code = 0;
      setUnitSensorError(unit, '');
    } else {
      logModuleProtocol(unit, 'IH: Plugin exit with code ' + code, 1);
      if (errstr) logModuleProtocol(unit, 'IH: STDERR ' + errstr, 0);
      setUnitSensorError(unit, errstr || code);
    }

    unitSet[unit].ps = '';
    unitSet[unit].ack = 0;
    unitSet[unit].wriTimeout = 0;
    unitSet[unit].toSend = [];
    unitSet[unit].laststop = Date.now();
    setStateUnitSensor(unit);

    if (!unitSet[unit].suspend && unitSet[unit].restarttime > 0) {
      debugMsg(unit, 'IH: restart timer ' + unitSet[unit].restarttime);
      tm.startTimer(unitSet[unit].restarttime, { owner: unit, tname: 'restart' });
    }
  }

  /** Остановить модуль
   *    @param {string} unit - идентификатор
   */
  function stopModule(unit, callback) {
    subsman.removeSub(unitSet[unit]);
    if (isModuleRunning(unit)) {
      unitSet[unit].ps.kill('SIGTERM');
      unitSet[unit].ps = 0;
      unitSet[unit].sigterm = 1;
      logModuleProtocol(unit, 'IH: Send SIGTERM.', 2);
    }
    if (callback) callback();
  }

  function startDeviceTimeoutTimers() {
    /*
    Object.keys(holder.devSet).forEach(dn => {
      if (holder.devSet[dn].timeout > 0) {
        startDeviceTimer(dn);
      }
    });
    */
  }

  function processMessage(mes, unit) {
    if (typeof mes != 'object' || !unitSet[unit]) return;

    if (mes.type == 'sub') {
      if (mes.event == 'tableupdated') {
        if (mes.filter.tablename == 'channels') {
          mes.filter.tablename = 'devhard';
          mes.filter.filter = { unit };
        }
        if (mes.filter.tablename == 'devhardlinks') {
          mes.filter.filter = { unit };
        }
      }
      subsman.doSub(mes, unitSet[unit], holder);
    } else {
      let txt = pluginmessage.process(mes, unitSet[unit], holder);
      if (txt) debugMsg(unit, txt);
    }
  }

  // *************         ОТРАБОТКА СОБЫТИЙ      ****************

  // Отработка событий таймеров
  function onTimerReady(timeobj) {
    if (!timeobj || !timeobj.owner || timeobj.tname) return;

    const name = timeobj.owner;
    switch (timeobj.tname) {
      case 'restart':
        // Запуск плагина если он не запущен и не suspend
        if (unitSet[name].active && !unitSet[name].suspend && !isModuleRunning(name)) startModule(name);
        break;

      case 'devicetimeout':
        // if (getDeviceTimeout(name)) {
        //  if (holder.getDevobj(name).isDeviceInTimeout()) holder.setDeviceTimeoutErrorState(name, 1);
        //  startDeviceTimer(name);
        // }
        break;

      default:
    }
  }

  // *********  ФУНКЦИИ ГЕНЕРАЦИИ СОБЫТИЙ
  function debugMsg(unit, txt) {
    if (unitSet[unit].debug) {
      holder.emit('debug', 'units.' + unit, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + txt);
    }
  }


  // *********  Вспомогательные функции
  function logModuleProtocol() {}

  // Установить значение  в зависимости от состояния плагина через функцию вирт устройства
  function setStateUnitSensor(unit) {
    const chobj = {};
    chobj[unitSet[unit].dn] = {
      dval: getCurrentUnitState(unit),
      laststart: unitSet[unit].laststart || 0,
      laststop: unitSet[unit].laststop || 0
    };
    holder.setDevPropsFromUnit(chobj);
  }

  function setUnitSensorError(unit, errstr) {
    const dobj = holder.getDevobj(unitSet[unit].dn);
    if (dobj) dobj.errstr = errstr;
  }

  function getCurrentUnitState(unit) {
    if (!unit || !unitSet[unit] || !unitSet[unit].active) return 0;

    if (unitSet[unit].suspend) return 1;
    return isModuleRunning(unit) ? 2 : 1;
  }
};

function getErrTxt(e) {
  if (typeof e == 'string') {
    return e;
  }

  if (typeof e == 'object') {
    return e.message ? e.message : JSON.stringify(e);
  }
  return 'ERROR ' + String(e);
}
