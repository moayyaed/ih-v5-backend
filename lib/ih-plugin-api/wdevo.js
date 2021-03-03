/**
 * wdevo.js - обертка для устройства при работе с ним в плагине
 */
// const util = require('util');

module.exports = class Wdevo {
  constructor(dobj, agent) {

    // this.dobj = dobj;
    if (dobj) {
      Object.keys(dobj).forEach(prop => {
        this[prop] = dobj[prop];   
      });
    }
    this.prev = {}; // prev values 
    this.agent = agent;
  }
/*
  get value() {
    // Number || String
    // return this.dobj.value;
    return this.value;
  }

  get state() {
    // Number
    // return this.dobj.stval == undefined ? 0 : this.dobj.stval;
    return this.stval == undefined ? 0 : this.stval;
  }

  get setpoint() {
    // Number
    // return this.dobj.setpoint;
    return this.setpoint;
  }

  get error() {
    // Number || String
    // return this.dobj.err == undefined ? '' : this.dobj.err;
    return this.err == undefined ? '' : this.err;
  }

  get auto() {
    // Boolean
    return !!this.dobj.auto;
  }

  get blk() {
    // Boolean
    return !!this.dobj.blk;
  }

  get id() {
    return this.dobj.dn;
  }

  get dn() {
    return this.dobj.dn;
  }

  get name() {
    return this.dobj.name;
  }

  get placeName() {
    return this.dobj.place_name;
  }

  get zoneName() {
    return this.dobj.room_name;
  }

  get fullName() {
    return this.dobj.fullName;
  }

  get stateName() {
    return this.dobj.nameOfState(this.dobj.stval);
  }
*/

  getParam(prop) {
    return this[prop] == undefined ? '' : this[prop];
  }


  // is
  // return: Boolean
  isOn() {
    return this.value > 0;
  }

  isOff() {
    return this.value == 0;
  }

  isError() {
    return this.error;
  }

  isNoError() {
    return !this.error;
  }

  // CONTROL
 // Отправляет команду на сервер
  do(command, value) {
    this.agent.doCommand(this, command, value);
  }

  on() {
    this.do('on');
  }

  off() {
    this.do('off');
  }

  toggle() {
    this.do('toggle');
  }

  turnOnSaveAuto() {
    this.do('aon');
  }

  turnOffSaveAuto() {
    this.do('aoff');
  }

  toggleSaveAuto() {
    this.do(this.isOn() ? 'aoff' : 'aon');
  }

  // SET
  // Сценарий изменяет  свойства устройства - возможно что на виртуальном уровне
  // Но должно сгенерироваться событие - поэтому все надо делать через commander
  setValue(value) {
    this.do('set', value);
  }

  setState(stval) {
    this.do('stval', stval);
  }

  setSetpoint(value) {
    this.do('defval', value);
  }

  setAuto(value) {
    this.do('auto', value);
  }

  setBlk(value) {
    this.do('blk', value);
  }

  setError(value) {
    this.do('err', value);
  }

  setParam(prop, value) {
    prop = this.dobj.getRealPropName(prop);
    if (this.dobj.isMainProp(prop)) {
      this.do('set', value);
    } else {
      this.do(prop, value);
    }
  }

  save(prop) {
    if (!prop || this.dobj[prop] == undefined) return;
    if (!this.dobj.scStore) this.dobj.scStore = {};
    this.dobj.scStore[prop] = this.dobj[prop];
  }

  restore(prop) {
    if (!prop || this.dobj[prop] == undefined || !this.dobj.scStore || this.dobj.scStore[prop] == undefined) return;
    this.setParam(prop, this.dobj.scStore[prop]);
  }

  // Напрямую переключаем флаг записи в БД
  dbwriteOn() {
    this.dobj.dbwrite_on = 1;
  }
  dbwriteOff() {
    this.dobj.dbwrite_on = 0;
  }
  
};
