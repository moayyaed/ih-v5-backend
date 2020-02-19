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
// const child = require('child_process');
// const fs = require('fs');

const appconfig = require('../appconfig');
const timerman = require('../utils/timermanager');
const dbstore = require('../dbs/dbstore');

/*
const hut = require('../utils/hut');
const jdb = require('../utils/jdb');


const up = require('../utils/updateutils');

const unito = require('./unito');
const subsmanager = require('./subsmanager');
const srvmanager = require('./srvmanager');
const channels = require('./channels');
const pluginmessage = require('./pluginmessage');
const firstStart = require('./firstStart');
const Filelogger = require('../utils/filelogger');
*/

const moduleLogName = 'PluginServer';
const unitSet = {}; // Подключенные экземпляры всех плагинов - объекты  unito

exports.start = function(holder) {
  const pluginspath = appconfig.getPluginsPath();

  // Запустить механизм таймеров c мин интервалом 1 сек для перезапуска плагинов
  const tm = new timerman.Timerman(1);
  tm.on('ready', onTimerReady);

  // Объект, реализующий механизм подписки для плагинов
  // const subsman = new subsmanager.Subsman();

  // Запустить плагины
  dbstore.get('units', {}, {}).forEach(item => {
  
    checkPlugin(item.plugin)
      .then(() => createAndRunUnit(item))
      .catch(e => {
        holder.logErr(`Plugin ${item.plugin} create error: ${util.inspect(e)}`, moduleLogName);
      });
  });

  // Сформировать таймеры устройств, у которых установлен timeout
  startDeviceTimeoutTimers();

  // **********   ФУНКЦИИ ПЛАГИНОВ

  function checkPlugin(plugin) {
    return holder.getPlugin(plugin);
    // return holder.getPlugin(plugin) ? Promise.resolve() : up.updatePluginP(plugin, houser);
  }

  /**
   * Создать объект unit и запустить модуль как дочерний процесс
   *     @param {object} item - свойства из файла units
   */
  function createAndRunUnit(item) {
    if (!item.id) return;

    let id = item.id;
    try {
      unitSet[id] = new unito.Unit(item, houser);


      // Создать системное устройство и установить его состояние, даже если не получилось запустить плагин
      // Возможно, устройство уже существует - тогда просто возвращается dn
      // createUnitSensor(id);
      unitSet[id].dn = houser.addUnitSensor(item);
      setStateUnitSensor(id);

      if (!unitSet[id].active) {
        logModuleProtocol(id, 'IH: Not active.', 0);
        return;
      }

      firstStart.start(unitSet[id], startModule, houser);
    } catch (e) {
      logModuleProtocol(id, 'IH: ' + e.message, 0);
      houser.logErr(e, 'Module ' + id + ' start error. ', moduleLogName);
      setTxtUnitSensor(id, getErrTxt(e));
    }
  }
  

  function startModule(unit, callback) {
    if (!unit || !unitSet[unit]) return;

    let reset = unitSet[unit].initOK ? 0 : 1;
    // unitSet[unit].suspend = 0;

    if (unitSet[unit].initproc && reset) {
      unitSet[unit].initproc(unitSet[unit], holder, err => {
        if (!err) {
          runModule(unit);
        } else {
          unitSet[unit].starterr = err;
          setTxtUnitSensor(unit, getErrTxt(err));
        }
        if (callback) callback(err);
      });
    } else {
      let err;
      try {
        runModule(unit);
      } catch (e) {
        logModuleProtocol(unit, 'IH: Run error. ' + e.message, 2);
        setTxtUnitSensor(unit, e.message);
        err = e;
      }
      if (callback) callback(err);
    }
  }


  function isModuleRunning(unit) {
    return unit && unitSet[unit] && unitSet[unit].ps;
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

};
