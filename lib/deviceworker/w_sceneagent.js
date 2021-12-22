/**
 * w_sceneagent.js
 *
 * Agent for sceno instances
 *  - tryStart
 *  - tryExec
 *  - works with scene timers
 *  -
 *  - debug
 */

const util = require('util');
const child = require('child_process');

const hut = require('../utils/hut');
const sceneutils = require('../scene/sceneutils');
const devsubset = require('./devsubset');
const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(wCore, settings) {
    this.wCore = wCore;
    this.settings = settings || {};
    this.running = ''; // Содержит id запущенного сценария для вывода debug

    this.activeSet = new Set(); // Активные сценарии - id экземпляра

    this.debugSet = {}; // Список сценариев, по которым нужно отдавать отладочные сообщения
    // id = sceneId, а не id экземпляра!!

    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  /** tryStart
   * Запуск экземпляра сценария  (метод check - опционально)=> метод start
   *
   * @param {String} id - id экземпляра сценария
   * @param {Array Of Objects} toRunItem - содержит информацию о причинах запуска:
   *                           { triggers: [], values: [], dn_prop: [] }
   * @return {Boolean} - 1 - сценарий остался в активном состоянии, 0 - нет
   */
  tryStart(id, toRunItem) {
    try {
      this.running = id;
      // запуск функции check, если она есть
      const needRun = this.wCore.sceneSet[id].hasMethod('check') ? this.wCore.sceneSet[id].check() : true;
      if (!needRun) {
        this.sayDebug(id, toRunItem, '---Check false. Not started ');
        this.running = '';
        return;
      }

      const ts = this.fixStart(id);
      this.wCore.currentScriptTs = ts;
      this.sayDebug(id, toRunItem, '---Started');
      this.wCore.sceneSet[id].triggers = toRunItem ? toRunItem.triggers : [];
      this.postTrace(id, { ts, state: 1 });
      this.wCore.sceneSet[id].start(); // Запуск функции start из скрипта
      this.running = ''; // Синхронная функция отработала

      if (!this.wCore.sceneSet[id].isPending()) {
        this.fixStop(id); // this.postTrace Выполняется в fixStop
      } else {
        this.postTrace(id, { state: 0, ts: Date.now() }); // сценарий активен, но скрипт завершился
        this.activeSet.add(id);
      }
    } catch (e) {
      const error = hut.getErrStrWoTrace(e);
      this.fixStop(id, error);
      this.debug(id, 'Blocked with run-time error: ' + error);
    }

    this.wCore.currentScriptTs = 0;
    return this.wCore.sceneSet[id].isActive();
  },

  /** tryExec
   * Запуск функции экземпляра сценария, когда он активен (обработчик таймера, слушателя)
   *
   * @param {String} id - id экземпляра сценария
   * @param {String} func - имя метода сценария
   * @param {Any} arg - может быть передан аргумент при запуске метода
   *                    Для функции слушателя это массив триггеров, по которому функция запустилась:
   *                    ['lamp.state','lamp.auto']
   *
   */
  tryExec(id, func, arg) {
    if (!id || !this.wCore.sceneSet[id]) return;

    const scenObj = this.wCore.sceneSet[id];
    try {
      if (func) {
        this.debug(id, 'exec function ' + func + (arg ? ' with arg ' + util.inspect(arg) : ''));
        this.running = id;
        scenObj[func](arg);
        this.running = '';
      }
      if (!scenObj.isPending()) {
        this.fixStop(id);
      }
    } catch (e) {
      this.debug(id, 'Error function ' + func + ':' + e.message);
      this.fixStop(id);
    }
  },

  tryStopAfterResponse(id, responseid) {
    const scenObj = this.wCore.sceneSet[id];
    if (scenObj) {
      delete scenObj.responsefn[responseid];
      if (!scenObj.isPending()) {
        this.fixStop(id);
      }
    }
  },

  /** postTrace
   *  Передача сообщения о состоянии скрипта при запуске и останове главному процессу
   * @param {String} id - id экземпляра сценария
   * @param {Object} { state, ts }
   */
  postTrace(id, { state, ts }) {
    const { sceneId, active, laststart, laststop, qstarts, blk, error } = this.wCore.sceneSet[id];
    this.wCore.postMessage('trace:handler', {
      hanid: id,
      state, // =1 если скрипт работает в данный момент. По этому флагу он блокируется
      ts,
      blk,
      error,
      sceneId,
      laststart,
      laststop,
      qstarts,
      active // =1 если сценарий активен (слушает, ждет таймеры)
    });
  },

  /** fixStart
   * Фиксирует запуск сценария
   * @param {String} id экземпляра
   * @param {String} sender - кто запустил
   * @return {ts} возвращает время, установленное как laststart
   */
  fixStart(id, sender) {
    if (this.wCore.sceneSet[id].isActive()) return;

    let ts = Date.now();
    this.wCore.sceneSet[id].__started(ts);
    if (sender) this.wCore.sceneSet[id].sender = sender;
    return ts;
  },

  /** exit
   * Останов сценария по команде exit из скрипта
   * @param {String} id - id экземпляра сценария
   */
  exit(id) {
    this.debug(id, 'Exit');
    this.fixStop(id);
  },

  /** fixStop
   * Фиксирует останов сценария
   *   в stopped удаляются слушатели и таймеры
   *   При ошибке сценарий блокируется
   *   Отправляет сообщение главному процессу
   *   Удаляет из списка активных сценариев
   * @param {String} id экземпляра
   * @param {String} error - строка ошибки
   * @return {ts} возвращает время, установленное как laststop
   */
  fixStop(id, error) {
    let ts = Date.now();
    this.wCore.sceneSet[id].__stopped(ts);
    this.wCore.sceneSet[id].sender = '';
    this.wCore.sceneSet[id].triggers = [];
    if (error) {
      this.wCore.sceneSet[id].error = error;
      this.wCore.sceneSet[id].blk = 1;
    }
    this.debug(id, '---Stopped---');
    this.postTrace(id, { ts, state: 0 });
    this.activeSet.delete(id); // Если не было - то и ладно
    return ts;
  },

  log(id, msg) {
    this.debug(id, 'LOG: ' + msg);
  },

  getRealdevs(id) {
    return this.wCore.sceneSet[id] ? this.wCore.sceneSet[id].realdevs : '';
  },

  doAll(id, filter, act, value) {
    // Сформировать Set устройств по фильтру
    let devs = devsubset(this.wCore.devSet, filter);
    if (!devs) return [];

    // Отобрать устр-ва, которые могут выполнить команду и сразу выполять?
    devs.forEach(dn => {
      let dobj = this.wCore.dnSet[dn];
      if (dobj.hasCommand(act)) {
        dobj.doCommand(act, this.running);
      }
    });
    return Array.from(devs); // Возвращаем массив dn устройств, для которого сработала групповая команда
  },

  sendInfo(id, infotype, sendObj) {
    this.debug(id, 'Send info ' + infotype + ':' + JSON.stringify(sendObj));
    sendObj.sender = 'scene_' + id;
    this.wCore.postMessage('send:info', { infotype, sendObj });
  },

  showDialog(id, dialogId, dest, sendObj) {
    this.debug(id, 'Show dialog :' + JSON.stringify(sendObj));
    sendObj.sender = 'scene_' + id;
    this.wCore.postMessage('show:dialog', { sendObj });
  },

  getSysTime(id, name, date) {
    let result;
    switch (name) {
      case 'sunrise':
      case 'sunset':
        result = hut.getSunTime(name, date, this.settings);
        break;
      case 'hourly':
        result = hut.getNextHourly();
        break;
      default:
        result = Date.now();
    }

    const txt = hut.getDateTimeFor(new Date(result), 'shortdtms') + ' (' + result + ')';
    this.debug(id, 'getSysTime ' + name + ' ' + date + ' = ' + txt);
    return result;
  },

  // Запускается прямо в worker-e ? 
  execOS(id, txt, responseid) {
    this.debug(id, 'execOS :' + txt);

    child.exec(txt, (error, stdout, stderr) => {
      if (error) {
        this.debug(id, `execOS error: ${error}`);
      }
      this.debug(id, `stdout: ${stdout}`);
      if (stderr) this.debug(id, `stderr: ${stderr}`);

      if (responseid && this.wCore.sceneSet[id].responsefn[responseid]) {
        this.tryExec(id, this.wCore.sceneSet[id].responsefn[responseid], stdout);
        this.tryStopAfterResponse(id, responseid);
      }
    });
  },

  // Нужно передать в основной процесс
  // Отработка responseid - при получении сообщения type:'command', response:1
  pluginCommand (id, comobj, responseid) {
    this.debug(id, 'pluginCommand ' + util.inspect(comobj));
    if (responseid) comobj.uuid = responseid;
    comobj.sender = 'scene_'+id;
    this.wCore.postMessage('send:plugin:command', { ...comobj });
    /*
    houser.emit('plugincommand', comobj, (err, playload) => {
      if (err) debugMsg(sceneId, 'Error: ' + util.inspect(err));

      if (responseid && sceneSet[sceneId].responsefn[responseid]) {
        tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], playload);
        tryStopAfterResponse(sceneId, responseid);
      }
    });
    */
  },

  pluginRestart (id, unit) {
    this.debug(id, 'pluginRestart: ' + unit);
    // Отправить команду на рестарт
  
    /*
    houser.emit('restartUnit', { id: unit, suspend: 1 }, err => {
      if (err) {
        debugMsg(sceneId, 'pluginRestart: Suspend error: ' + util.inspect(err));
        houser.logErr(err, unit + ' pluginRestart error', moduleLogName);
      } else {
        debugMsg(sceneId, 'pluginRestart: After 2 seс resume ' + unit);
        setTimeout(() => {
          houser.emit('restartUnit', { id: unit, suspend: 0 }, err1 => {
            if (err1) {
              debugMsg(sceneId, 'pluginRestart: Resume error: ' + util.inspect(err1));
              houser.logErr(err1, unit + ' pluginRestart error', moduleLogName);
            } else {
              debugMsg(sceneId, ' ' + unit);
            }
          });
        }, 2000);
      }
    });
    */
  },

  /**
   * 
   script({
     start() { 
      this.snap("105","onSnap105");
      },
      onSnap105(result) { 
        this.info("telegram","OWNER", { img:result.filename, txt: "Cam 105" });
      }
    })
   */
  snap(id, fobj, responseid) {
    this.debug(id, 'snap:' + JSON.stringify(fobj));

    if (!fobj || !responseid) {
      this.debug(id, 'snap: Empty or invalid arguments!');
      this.tryStopAfterResponse(id, responseid);
      return;
    }

    let comobj = { unit: 'cctv', uuid: 'snap_' + responseid, command: 'snap', id: fobj, camid: fobj };

    this.debug(id, 'plugincommand ' + JSON.stringify(comobj));
    // Отправить команду плагину, фиксировать callback, который выполнится, когда придет ответ от плагина

    /*
    houser.emit('plugincommand', comobj, (e, result) => {
      debugMsg(sceneId, 'plugincommand result ' + JSON.stringify(result));
      if (sceneSet[sceneId].isActive() && sceneSet[sceneId].responsefn && sceneSet[sceneId].responsefn[responseid]) {
        tryExec(sceneId, sceneSet[sceneId].responsefn[responseid], result);
        tryStopAfterResponse(sceneId, responseid);
      }
    });
    */
  },

  // ----------- Функции отладочных сообщений ---------------
  /** debug
   * Передача отладочного сообщения главному процессу
   *  Сообщение передается, если для сценария включен режим отладки (debugSet[id]=1)
   *     отладка происходит в целом для сценария (любой конкретный экземпляр мульти)
   * @param {String} id - id экземпляра сценария
   * @param {String} msg
   */
  debug(id, msg) {
    id = sceneutils.getSceneId(id);
    if (this.debugSet[id]) {
      const message = hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg;
      this.wCore.postMessage('debug:scene', { id, message });
    }
  },

  // Обертка для передачи данных о значении устройств из текущего (this.running) скрипта
  debugWrap(msg) {
    this.debug(this.running, msg);
  },

  getWorkingScript() {
    return this.running;
  },

  /** debugctl
   * Переключение режима отладчика
   *  Если отладка включается - вывести текущее состояние
   *
   * @param {1/0} mode - 1=отладка включена
   * @param {String} sceneId - id сценария (не экземпляра)
   * @param {1/0} multi
   */
  debugctl(mode, id, multi) {
    this.debugSet[id] = mode;
    if (mode) this.debug(id, this.getStatusStr(id, multi));
  },

  /** getStatusStr
   * Формирует сообщение о текущем состоянии сценария (всех экземпляров мульти)
   *
   * @param {String} sceneId
   * @param {1/0} multi
   * @return {String}
   */
  getStatusStr(sceneId, multi) {
    if (multi) {
      let str = ' Multi ' + sceneId + '\n';
      let count = 0;
      Object.keys(this.wCore.sceneSet).forEach(id => {
        if (this.wCore.sceneSet[id] && id.startsWith(sceneId + '#')) {
          count += 1;
          str += count + '. Instance with ' + this.getDevMapStr(id) + ' ' + this.getInstanceStatusStr(id) + '\n';
        }
      });
      return str;
    }
    return sceneId + ' ' + this.getInstanceStatusStr(sceneId);
  },

  /** getDevMapStr
   * Формирует строку соответствия параметр:реальное устройство для устройств сценария (экземпляра)
   *
   * @param {String} id экземпляра
   * @return {String}
   *         lamp:H101_1 motion:DD101_1
   */
  getDevMapStr(id) {
    if (!this.wCore.sceneSet[id] || !this.wCore.sceneSet[id].def) return '';
    let str = '';
    Object.keys(this.wCore.sceneSet[id].def).forEach(key => {
      str += key + ':' + this.wCore.sceneSet[id].def[key] + ' ';
    });
    return str;
  },

  /** getInstanceStatusStr
   * Формирует строку с текстом статуса
   *
   * @param {String} id экземпляра
   * @return {String}
   */
  getInstanceStatusStr(id) {
    if (!this.wCore.sceneSet[id]) return 'No script';
    if (this.wCore.sceneSet[id].isActive()) return 'Working';
    if (this.wCore.sceneSet[id].blk) return 'Blocked ' + (this.wCore.sceneSet[id].error || '');
    return 'Not active';
  },

  /** sayDebug
   *  Формирует и выдает сообщение о запуске (Started или Check false) в debug
   *
   * @param {String} id - id экземпляра сценария
   * @param {Array Of Objects} toRunItem - содержит информацию о причинах запуска:
   *                            { triggers: [], values: [], dn_prop: [] }
   * @param {String} what - шапка сообщения
   */
  sayDebug(id, toRunItem, what) {
    if (sceneutils.isMulti(id)) {
      const sceneId = sceneutils.getSceneId(id);
      if (this.debugSet[sceneId]) {
        this.debug(sceneId, what + ' instance (' + this.getRealdevs(id) + ') ' + getTriggersStr());
      }
    } else if (this.debugSet[id]) this.debug(id, what + ' ' + getTriggersStr());

    function getTriggersStr() {
      if (!toRunItem || !toRunItem.triggers.length) return '';
      let str = ' onChange ';
      toRunItem.dn_prop.forEach((el, idx) => {
        str += el + '=' + toRunItem.values[idx] + ' ';
      });
      str += ' Triggers: ' + util.inspect(toRunItem.triggers);
      return str;
    }
  },

  // -------------------  Функции таймеров -------------------
  startTimer(id, tname, interval, callback) {
    const tobj = this.tm.setTimer({ owner: id, tname, interval }, callback);
    this.debug(id, 'Start timer ' + tname + ' for ' + interval + ' sec');
    return tobj;
  },

  restartTimer(id, tname, interval, callback) {
    const tobj = this.tm.setTimer({ owner: id, tname, interval, restart: true }, callback);
    this.debug(id, 'Start/restart timer ' + tname + ' for ' + interval + ' sec');
    return tobj;
  },

  stopTimer(id, tname) {
    this.tm.clearTimer(id, tname);
    this.debug(id, 'Stop timer ' + tname);
  },

  /*
  startTimer (sceneId, timername, interval) {
    // Интервальный таймер
    if (interval < 200000) {
      debugMsg(sceneId, 'start timer ' + timername + ' for ' + interval + ' sek');
      return tm.startTimer(interval, { owner: sceneId, tname: timername });
    }

    // Таймер на точку времени (ts)
    const txt = hut.getDateTimeFor(new Date(interval), 'shortdtms') + ' (' + interval + ')';
    debugMsg(sceneId, 'start timer ' + timername + ' on time = ' + txt);
    return sctm.addTimer({ qts: interval, owner: sceneId, tname: timername });
  },

  stopTimer (sceneId, timername, interval) {
    debugMsg(sceneId, 'stop timer ' + timername);

    if (interval < Date.now()) {
      // Интервальный таймер
      tm.deleteTimer(interval, { owner: sceneId, tname: timername });
    } else {
      sctm.deleteTimer({ owner: sceneId, tname: timername });
    }
  },
  */

  // Отработка событий таймеров
  /**
   *
   * @param {*} timeobj  { owner, tname, callback, sts, qts }
   */
  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      const { owner, tname, callback } = timeobj;
      if (!this.wCore.sceneSet[owner]) return;

      const scenObj = this.wCore.sceneSet[owner];
      if (scenObj.isActive() && scenObj.getTimerState(tname) == 1 && timeobj.sts >= scenObj.laststart) {
        const call = scenObj.getTimerCall(tname);
        scenObj.setTimerState(tname, 2, timeobj);
        this.debug(owner, 'Timer ' + tname + ' done.');

        // Если есть функция, которую надо запустить - запуск
        this.tryExec(owner, call);
      }
    }
  }
};
