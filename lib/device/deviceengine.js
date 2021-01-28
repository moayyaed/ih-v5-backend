/**
 * deviceengine.js
 */
const util = require('util');

const Devo = require('./devo');

class Deviceengine {
  constructor(holder, dm, agent) {
    this.holder = holder;
    this.dm = dm;
    this.agent = agent;

    this.devSet = {}; // key= _id (did)
    this.dnSet = {}; // key = dn,
    this.holder.devSet = this.devSet;
    this.holder.dnSet = this.dnSet;

    agent.start(holder, dm);
  }

  start(typestore) {
    this.typestore = typestore;

    // Событие: получены данные от плагина
    this.holder.on('received:device:data', getObj => {
      const accepted = [];
      Object.keys(getObj).forEach(did => {
        if (did && this.devSet[did]) {
          accepted.push(...this.devSet[did].acceptData(getObj[did]));
        } else console.log('ERROR: Handle received:device:data. Device not found ' + did+' Exists: '+Object.keys(this.devSet).join(','));
      });

      if (accepted.length) {
        this.agent.emitDeviceDataAccepted(accepted);
      }
    });
  }

  /**
   * Добавить новое устройство
   *
   * @param {*} doc - запись из таблицы
   * @param {*} dataObj - сохраненные значения динамических свойств
   * @param {*} chanObj - привязки к каналам из devhard
   * @param {*} devLogArr - массив для формирования журнала устройства
   */
  addDevice(doc, dataObj, chanObj, devLogArr) {
    if (doc.dn) {
      this.devSet[doc._id] = new Devo(doc, this.typestore, this.agent, dataObj, chanObj);
      this.dnSet[doc.dn] = this.devSet[doc._id]; // Объект устройства для обращения по dn, свойства плоские
  
      if (devLogArr && devLogArr.length) {
        // добавить последние 100 записей в журнал устройства
        const idx = devLogArr.length > 100 ? devLogArr.length - 100 : 0;
        for (let i = idx; i < devLogArr.length; i++) this.devSet[doc._id].addToInnerLog(devLogArr[i]);
      }
    } else {
      console.log('WARN: devices._id = ' + doc._id + '. NO dn! SKIPPED doc: ' + util.inspect(doc));
    }
  }

  removeDevice(doc) {
    if (!doc || !doc._id) return;
    if (doc.dn) this.dnSet[doc.dn] = null;

    if (this.devSet[doc._id]) {
      delete this.devSet[doc._id];
    }
  }

  getDevice(did) {
    return this.devSet[did];
  }

  hasDevice(did) {
    return !!this.devSet[did];
  }

  setChannelLink(did, prop, upDoc) {
    console.log('ENGINE setChannelLink ' + did + ' ' + prop + util.inspect(upDoc));
    if (!this.devSet[did]) return;

    this.devSet[did].setChannel(prop, upDoc);
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    this.devSet[did].clearChannel(prop);
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
    console.log('WARN: deviceengine.changeDeviceType');
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

  // При сбросе привязки к каналу - сбросить значение на дефолтное
  resetValueWithDefault(did, prop) {
    if (!this.devSet[did]) return;
    this.holder.emit('received:device:data', { [did]: { [prop]: 0 } });
  }
}

module.exports = Deviceengine;
