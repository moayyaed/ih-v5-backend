/**
 * w_sceno.js - объект сценария внутри worker-a
 */

const util = require('util');

const timerStateName = ['off', 'on', 'done'];

class Sceno {
  /**
   *
   * @param {Object} scenObj - объект описания сценария 
   * {
    id: 'scen002',
    sceneId: 'scen002',
    blk: 0,
    multi: 0,
    error: '',
    filename: '/var/lib/intrahouse-d/projects/miheev_ih/scenes/req/scene_scen002.js',
    devs: 'motion,lamp',
    realdevs: 'DD101_1,H101_1',
    starttriggers: 'motion',
    def: { motion: 'DD101_1', lamp: 'H101_1' }
  }
   * @param {Object} devs - фактический параметр при запуске скрипта
   *         содержит объекты устройств сценария (объявленные как Device) + globals
   * @param {Object} agent
   */
  constructor(scenObj, devs, agent) {
    try {
      Object.assign(this, scenObj); // is, sceneId,
      const script = require(this.filename)(devs);
      // const script = require(filename)();
      Object.assign(this, script); // Добавить функции (и переменные) из скрипта

      this.updef = {}; // вывернуть def для быстрого доступа при сработке
      if (typeof this.def == 'object') {
        Object.keys(this.def).forEach(key => {
          this.updef[this.def[key]] = key;
        });
      }
    } catch (e) {
      console.log('ERROR: Sceno ' + this.id + ' ' + util.inspect(e));
    }
    //

    this.timerSet = {};
    this.timer = {};
    this.listeners = {};
    this.responsefn = {};
    this.active = 0; // 0 - не запущен, 1 - запущен

    this.laststart = 0;
    this.laststop = 0;
    this.qstarts = 0;
    this.agent = agent;
  }

  isReady() {
    return !this.active && !this.blk;
  }

  isActive() {
    return this.active === 1;
  }

  __started(ts) {
    this.active = 1;
    this.laststart = ts;
    this.laststop = 0;
    this.qstarts += 1;
  }

  __stopped(ts) {
    this.active = 0;
    this.laststop = ts;
    this.timerSet = {};
    this.timer = {};
    this.listeners = {};
  }

  hasScript(propname, proptype) {
    return this[propname] && typeof this[propname] === proptype;
  }

  hasMethod(propname) {
    return this[propname] && typeof this[propname] === 'function';
  }

  isPending() {
    return !isObjIdle(this.listeners) || !isObjIdle(this.responsefn) || this.hasPendingTimers();
  }

  // Функции сценария - Вызываются через this из тела сценария
  addListener(trigger, func) {
    if (!trigger || !func) return;
    const [dn, prop] = trigger.split('.');
    if (this.def[dn]) {
      const listenerKey = prop ? this.def[dn]+'.'+prop : this.def[dn];
      this.listeners[listenerKey] = func;
      this.agent.debug(this.id, 'addListener ' + trigger);
    } else {
      this.agent.debug(this.id, 'ERROR addListener: not found device for trigger '+trigger)
    }
  }

  removeListener(trigger) {
    if (trigger && this.listeners[trigger]) delete this.listeners[trigger];
  }

  // this.doAll({tag:"свет", place:"dg001"}, "off"<,value>);
  doAll(filter, command, value) {
    return this.agent.doAll(this.id, filter, command, value);
  }
  
  /*
  assign(dobj, prop, value) {
    this.agent.emit('assign', this.id, dobj, prop, value);
  }


  pluginCommand(command, callback) {
    this.agent.emit('pluginCommand', this.id, command, callback);
  }
  */
  block(val) {
    if (val && this.isActive()) {
      this.__stopped();
    }
    this.blk = val ? 1 : 0;
  }

  exit() {
    this.agent.exit(this.id);
  }

  log(txt) {
    this.agent.log(this.id, txt);
  }

  getSysTime(name, date) {
    // ??
    return this.agent.getSysTime(this.id, name, date);
  }

  dbwrite(payload, tablename, columns) {
    return this.agent.dbwrite(this.id, payload, tablename, columns);
  }

  dbread(fobj, func) {
    const id = String(Date.now());
    this.responsefn[id] = func;
    this.agent.dbread(this.id, fobj, id);
  }

  snap(fobj, func) {
    const id = String(Date.now());
    this.responsefn[id] = func;
    this.agent.emit('snap', this.id, fobj, id);
  }

  info(infotype, dest, txt) {
    let sobj;
    if (typeof txt == 'object') {
      sobj = Object.assign({ dest }, txt);
    } else {
      sobj = { txt, dest };
    }
    this.agent.emit('sendInfo', this.name, infotype, sobj);
  }

  execOS(txt, func) {
    if (func) {
      const id = String(Date.now());
      this.responsefn[id] = func;
      this.agent.emit('execOS', this.name, txt, id);
    } else this.agent.emit('execOS', this.name, txt);
  }

  alert(mess) {
    console.log(this.name + ' Alert: ' + mess);
  }

  /** ТАЙМЕРЫ   ***************************************** */
  /** Функции таймеров сценариев
   * Используется два свойства:
   *  timer[id таймера] == 'off/on/done' - исп в условных выражениях:  this.timer.T1 == 'done'
   *  timerSet[id таймера] = {id:id, sts:xx, qts:yy, state:<0,1,2>, call:<func name>}
   */

  addTimer(timername) {
    // Это можно не делать Используется если нужно в условных выражениях было off сразу пока таймер не опр
    this.timerSet[timername] = { state: 0, sts: 0, qts: 0, call: '' };
    this.timer[timername] = timerStateName[0];
  }

  startTimer(timername, interval, callback) {
    // TODO ?? Взвести таймер, только если он еще не взведен. Если взведен - игнорировать??
    // let tsobj = this.agent.startTimer( this.id, timername, interval);
    let tsobj = this.agent.startTimer(this.id, timername, interval, callback);

    if (tsobj) {
      this.setTimerState(timername, 1, tsobj, interval, callback);
    }
  }

  restartTimer(timername, interval, callback) {
    let tsobj = this.agent.restartTimer(this.id, timername, interval, callback);
    if (tsobj) {
      this.setTimerState(timername, 1, tsobj, interval, callback);
    }
  }

  stopTimer(timername) {
    if (this.timerSet[timername]) {
      this.agent.stopTimer(this.id, timername);
      this.setTimerState(timername, 0);
    }
  }

  setTimerState(timername, state, tsobj, interval, callback) {
    if (!this.timerSet[timername]) this.timerSet[timername] = {};

    this.timerSet[timername].state = state;
    this.timerSet[timername].interval = interval;
    this.timerSet[timername].call = callback || '';

    if (!state) {
      this.timerSet[timername].sts = 0;
      this.timerSet[timername].qts = 0;
    } else {
      if (tsobj && tsobj.sts) this.timerSet[timername].sts = tsobj.sts;
      if (tsobj && tsobj.qts) this.timerSet[timername].qts = tsobj.qts;
    }
    this.timer[timername] = timerStateName[state];
  }

  getTimerState(timername) {
    return this.timerSet && this.timerSet[timername] ? this.timerSet[timername].state : 0;
  }

  getTimerCall(timername) {
    return this.timerSet[timername] ? this.timerSet[timername].call : '';
  }

  hasPendingTimers() {
    return !isObjIdle(this.timerSet) && Object.keys(this.timerSet).some(timer => this.timerSet[timer].state == 1);
  }
}

const isObjIdle = obj => typeof obj !== 'object' || Object.keys(obj).length <= 0;

module.exports = Sceno;

/**
 *  scenObj= {
    id: 'scen002',
    sceneId: 'scen002',
    blk: 0,
    multi: 0,
    error: '',
    filename: '/var/lib/intrahouse-d/projects/miheev_ih/scenes/req/scene_scen002.js',
    devs: 'motion,lamp',
    realdevs: 'DD101_1,H101_1',
    starttriggers: 'motion',
    def: { motion: 'DD101_1', lamp: 'H101_1' },
    active: 0,
    laststart: 0,
    laststop: 0,
    qstarts: 0
  }
 */


