/**
 * deviceengine.js
 */
const util = require('util');
// const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

const Devo = require('./devo');

class Deviceengine {
  constructor(holder, typestore) {
    this.holder = holder;
    this.typestore = typestore;
  }

  start(devDocs) {
    this.devSet = {}; // key= _id (did)
    this.dnSet = {}; // key = dn,

    devDocs.forEach(item => {
      this.addDevice(item);
    });

    this.holder.devSet = this.devSet;
    this.holder.dnSet = this.dnSet;

    this.holder.on('get:device:data', getObj => {
      const changed = [];
      console.log('get:device:data getObj=' + util.inspect(getObj));
      Object.keys(getObj).forEach(did => {
        console.log('get:device:data did=' + did);
        if (this.devSet[did]) {
          changed.push(...this.devSet[did].change(getObj[did]));
        } else console.log('Device not found: DID=' + did);
      });

      if (changed.length) {
        // console.log('changed:device:data ' + util.inspect(changed));
        this.holder.emit('changed:device:data', changed);
      }
    });
  }

  addDevice(item) {
    if (item.dn) {
      this.devSet[item._id] = new Devo(item, this.typestore);
      this.dnSet[item.dn] = this.devSet[item._id]; // Объект устройства для обращения по dn, свойства плоские
    } else {
      console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      delete this.dnSet[olddn];
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
  }

  // Изменили тип устройства
  changeDeviceType(did, type, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.devSet[did].changeType(type, addProps, deleteProps);
      this.changeWithRaw(did);
    }
  }

  // Изменился сам тип (набор свойств)
  changeDeviceProps(did, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.devSet[did].changeTypeProps(addProps, deleteProps);
      // Пересчитать значения
      this.changeWithRaw(did);
    }
  }

  // Изменение других плоских полей, хранимых в devSet
  changeDeviceFields(did, chobj) {
    if (this.devSet[did]) this.devSet[did].changeFlatFields(chobj);
  }

  changeDeviceAux(did, auxArr) {
    if (this.devSet[did] && auxArr) {
      auxArr.forEach(item => {
        this.devSet[did].updateAux(item.prop, item.auxprop, item.val);
      });
      // изменились свойства - пересчитать значения
      this.changeWithRaw(did);
    }
  }

  changeWithRaw(did) {
    if (!this.devSet[did]) return;

    const changed = this.devSet[did].changeWithRaw();
    console.log('EMIT changeWithRaw changed:device:data '+util.inspect(changed))
    if (changed.length) {
      this.holder.emit('changed:device:data', changed);
    }
  }
}

module.exports = Deviceengine;
