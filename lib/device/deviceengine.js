/**
 * deviceengine.js
 */
const util = require('util');
// const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
const agent = require('./agent'); //
const Devo = require('./devo');

class Deviceengine {
  constructor(holder) {
    this.holder = holder;

    this.devSet = {}; // key= _id (did)
    this.dnSet = {}; // key = dn,
    this.holder.devSet = this.devSet;
    this.holder.dnSet = this.dnSet;

    this.agent = agent;
    agent.start(holder);
  }

  start(devDocs, hardDocs, typestore) {
    this.typestore = typestore;

    console.log('INFO: Device engine has started, devices: '+devDocs.length);

    devDocs.forEach(item => {
      this.addDevice(item);
    });

    hardDocs.forEach(item => {
      if (item.did && item.prop && item.unit && item.w) {
        this.updateWriteChan(item.did, item.prop, item.unit);
      }
    });

    // Событие: получены данные от плагина
    this.holder.on('received:device:data', getObj => {
      const accepted = [];
      Object.keys(getObj).forEach(did => {
        if (this.devSet[did]) {
          accepted.push(...this.devSet[did].acceptData(getObj[did]));
        } else console.log('ERROR: Device not found ' + did);
      });

      if (accepted.length) {
       this.agent.emitDeviceDataAccepted(accepted);
      }
    });

  }

  addDevice(item) {
    if (item.dn) {
      this.devSet[item._id] = new Devo(item, this.typestore, this.agent);
      this.dnSet[item.dn] = this.devSet[item._id]; // Объект устройства для обращения по dn, свойства плоские
    } else {
      console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }

  removeDevice(doc) {
    if (!doc || !doc._id) return;
    if (doc.dn) this.dnSet[doc.dn] = null;

    if (this.devSet[doc._id]) {
      delete this.devSet[doc._id];
    }
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
    this.dnSet[olddn] = null;
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
    // Перепринять данные на базе значений raw
    const accepted = this.devSet[did].changeWithRaw();
   
    if (accepted.length) {
      this.agent.emitDeviceDataAccepted(accepted);
    }
  }

  // Документ пришел при редактировании devhard
  updateWriteChan(did, prop, unit) {
    if (!this.devSet[did]) return;
    this.devSet[did].setWriteChan(prop, unit);
  }
}

module.exports = Deviceengine;
