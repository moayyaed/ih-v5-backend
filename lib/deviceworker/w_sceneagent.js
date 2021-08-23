/**
 * w_sceneagent.js
 *
 * Agent for sceno instances
 *  - emits via wCore
 *  - works with scene timers
 *  - debug
 */

const util = require('util');

const hut = require('../utils/hut');
const sceneutils = require('../scene/sceneutils');


const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(wCore) {
    this.wCore = wCore;
    this.listenersOnChange = {}; // {<dn>:{<prop>: new Set [scen001, scen004]}}
    this.running = '';

    this.debugSet = {}; // Список сценариев, по которым нужно отдавать отладочные сообщения
    // id = sceneId, а не id экземпляра!!

    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  debugctl(mode, id, multi) {
    this.debugSet[id] = mode;

    if (mode) {
      // Включена подписка - вывести текущее состояние
      this.debug(id, this.getStatusStr(id, multi));
    }
  },

  getStatusStr(sceneId, multi) {
    if (multi) {
      let str = '\nMulti ' + sceneId + '\n';
      let count = 0;
      Object.keys(this.wCore.sceneSet).forEach(id => {
       
        if (this.wCore.sceneSet[id] && id.startsWith(sceneId + '#')) {
          count += 1;
          str += count+' instance (' + this.getRealdevs(id)+') '+this.getInstanceStatusStr(id)+ '\n';
        }
      });
      return str;
    }

    return sceneId +' '+this.getInstanceStatusStr(sceneId);
  },

  getInstanceStatusStr(id) {
    if (!this.wCore.sceneSet[id]) return 'Missing scene instance: ' + id;
    if (this.wCore.sceneSet[id].isActive()) return 'Working';
    if (this.wCore.sceneSet[id].blk) return 'Blocked ' + (this.wCore.sceneSet[id].error || '');
    return 'Not active';
  },

  tryStart(id, toRunItem) {
    let active = 1;
    const ts = this.fixStart(id);

    this.wCore.currentScriptTs = ts;

    const traceObj = { hanid: id, sceneId: this.wCore.sceneSet[id].sceneId, active, state: 1, ts };

   

    // id - экземпляр сценария
    if (sceneutils.isMulti(id)) {
      const sceneId = sceneutils.getSceneId(id);
      if (this.debugSet[sceneId]) {
        this.debug(sceneId, '---Started instance (' +this.getRealdevs(id)+') '+ getTriggersStr());
      }
    } else if (this.debugSet[id]) this.debug(id, '---Started ' + getTriggersStr());
    


    try {
      this.wCore.sceneSet[id].triggers = toRunItem ? toRunItem.triggers : [];
      this.postTrace(id, traceObj);
      this.running = id;
      this.wCore.sceneSet[id].start(); // Запуск функции start из скрипта
      this.running = '';
      // Синхронная часть завершилась
      if (!this.wCore.sceneSet[id].isPending()) {
        this.fixStop(id);
        active = 0;
      }
    } catch (e) {
      const error = hut.getErrStrWoTrace(e);
      this.fixStop(id, error);
      this.debug(id, 'Blocked with run-time error: ' + error);
    }
    this.postTrace(id, { ...traceObj, state: 0, ts: Date.now(), active });
    this.wCore.currentScriptTs = 0;

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

  postTrace(id, traceObj) {
    const { sceneId, laststart, laststop, qstarts, blk, error } = this.wCore.sceneSet[id];
    this.wCore.postMessage('trace:handler', {
      hanid: id,
      ...traceObj,
      blk,
      error,
      sceneId,
      laststart,
      laststop,
      qstarts
    });
  },

  exit(id) {
    this.debug(id, 'Exit');
    this.fixStop(id);
  },

  fixStart(id, sender) {
    if (!this.wCore.sceneSet[id].isActive()) {
      let ts = Date.now();
      this.wCore.sceneSet[id].__started(ts);
      if (sender) this.wCore.sceneSet[id].sender = sender;
      return ts;
    }
  },

  fixStop(id, error) {
    // TODO Удалить все алерты этого сценария,
    // слушатели и таймеры удаляются в stopped

    this.wCore.sceneSet[id].chobj = '';
    let ts = Date.now();
    this.wCore.sceneSet[id].__stopped(ts);
    this.wCore.sceneSet[id].sender = '';
    if (error) {
      this.wCore.sceneSet[id].error = error;
      this.wCore.sceneSet[id].blk = 1;
    }
    this.debug(id, '---Stopped---');
  },

  addListener(id, func) {
    console.log('AGENT addListener func=' + func);
  },

  tryExec(id, func, arg) {
    console.log('tryExec func=' + func);
    if (!id) return;
    const scenObj = this.wCore.sceneSet[id];
    if (!scenObj.isActive()) return;

    try {
      if (func) {
        this.debug(id, 'exec function ' + func);
        this.running = id;
        if (arg) {
          scenObj[func](arg);
        } else {
          scenObj[func]();
        }
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

  /*
  setWorksceneStatus(id, obj) {
    if (obj && this.wCore.worksceneSet[id]) {
      Object.assign(this.holder.worksceneSet[id], obj)
    }
  },
  */

  log(id, msg) {
    this.debug(id, 'LOG: ' + msg);
  },

  getRealdevs(id) {
    return this.wCore.sceneSet[id] ? this.wCore.sceneSet[id].realdevs : '';
  },

 

  debug(id, msg) {
    id = sceneutils.getSceneId(id);
    if (this.debugSet[id]) {
      const message = hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg;
      this.wCore.postMessage('debug:scene', { id, message });
    }
  },

  debugWrap(msg) {
    //  const id = this.running;
    this.debug(this.running, msg);
  },

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
