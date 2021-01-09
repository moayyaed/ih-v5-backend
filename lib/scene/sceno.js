/**
 * sceno.js - объект сценария
 */

const util = require('util');

const timerStateName = ['off', 'on', 'done'];

class Basesceno {
  constructor(id, agent) {
    this.id = id;
    this.blk = 0;
    this.__active = 0; // 0 - не запущен, 1 - запущен
    this.laststart = 0;
    this.laststop = 0;
    this.qstarts = 0;
    this.agent = agent;
  }

  isReady() {
    return !this.__active && !this.blk;
  }

  isActive() {
    return this.__active === 1;
  }


  __started(ts) {
    this.__active = 1;
    this.laststart = ts;
    this.qstarts += 1;
    this.agent.debug(this.id, 'Started');
  }

  __stopped(ts) {
    this.__active = 0;
    this.laststop = ts;
    this.timerSet = {};
    this.timer = {};
    this.listeners = {};
    this.agent.debug(this.id, 'Stopped');
  }
}

class Sceno extends Basesceno {
  /**
   *
   * @param {String} id - имя сценария (идентификатор)
   * @param {String} filename - полный путь к файлу скрипта для загрузки
   * @param {Object} devs - фактический параметр при запуске скрипта
   *         содержит объекты устройств сценария (объявленные как Device) + global
   * @param {Object} agent
   */
  constructor(id, agent, filename, devs) {
    super(id, agent);

    try {
      const script = require(filename)(devs);
      // const script = require(filename)();
      Object.assign(this, script);
    } catch (e) {
      console.log('ERROR: Sceno ' + id + ' ' + util.inspect(e));
      // throw { message: name+': Missing or invalid file '+filename };
    }
    // if (!this.hasScript('start', 'function')) throw { message: name+': Missing function start' };

    this.timerSet = {};
    this.timer = {};
    this.listeners = {};
    this.responsefn = {};
  }

  hasScript(propname, proptype) {
    return this[propname] && typeof this[propname] === proptype;
  }

  isPending() {
    return !isObjIdle(this.listeners) || !isObjIdle(this.responsefn) || this.hasPendingTimers();
  }

  // Функции сценария - Вызываются через this из тела сценария
  addListener(dobj, func) {
    if (!dobj || !dobj.dn || !func) return;
    this.listeners[dobj.dn] = func;
  }

  removeListener(dobj) {
    if (dobj && dobj.dn && this.listeners[dobj.dn]) delete this.listeners[dobj.dn];
  }
  /*
  assign(dobj, prop, value) {
    this.agent.emit('assign', this.id, dobj, prop, value);
  }

  do(dobj, command, value) {
    this.agent.emit('doCommand', this.id, dobj, command, value);
  }

  doAll(filter, command, value) {
    this.agent.emit('doAll', this.id, filter, command, value);
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
    this.agent.emit('exit', this.id);
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

  startTimer(timername, interval, call) {
    // TODO ?? Взвести таймер, только если он еще не взведен. Если взведен - игнорировать??
    let tsobj = this.agent.emit('startTimer', this.id, timername, interval);

    if (tsobj) {
      this.setTimerState(timername, 1, tsobj);
      this.timerSet[timername].interval = interval;
      this.timerSet[timername].call = call || '';
    }
  }

  stopTimer(timername) {
    if (this.timerSet[timername]) {
      this.agent.emit('stopTimer', this.id, timername, this.timerSet[timername].interval);
      this.setTimerState(timername, 0);
    }
  }

  setTimerState(timername, state, tsobj) {
    if (!this.timerSet[timername]) this.timerSet[timername] = {};

    this.timerSet[timername].state = state;

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

module.exports = { Sceno, Basesceno };
