/**
 * deviceengine_m.js
 * Работает с устройствами на стороне основного процесса
 *  - добавление/удаление/изменение устройств и типов
 *  - передать сообщение об изменениях воркеру
 * 
 *  Здесь устройство - анемичный объект (структура), никакие методы и обработчики не запускаются
 *   
 */
const util = require('util');

// const hut = require('../utils/hut');
const devfactory = require('./devfactory');
const deviceutil = require('./deviceutil');

const typestore = require('./typestore');


class Deviceengine {
  constructor(holder, worker) {
    this.holder = holder;
    this.dm = holder.dm;
    this.worker = worker;

    this.devSet = holder.devSet; // key= _id (did) devSet Уже сформирован в load
    this.dnSet = holder.dnSet;// key = dn,
  
    // this.globals = wrapGlobal(this.holder.glSet);
  }

  start() {
   
    //  Создать системный индикатор  Возможно, он уже создан - тогда не создавать
    // Собщение от pluginengine
    this.holder.on('create:unitIndicator', unitId => {
      const id = deviceutil.getUnitIndicatorId(unitId);
      if (!this.hasDevice(id)) {
        this.addDevice(deviceutil.createUnitIndicatorDoc(unitId));
        this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
      }
    });

    // Удалить системный индикатор
    this.holder.on('remove:unitIndicator', unitId => {
      const id = deviceutil.getUnitIndicatorId(unitId);
      if (this.hasDevice(id)) {
        this.removeDevice({ _id: id });
        deviceutil.removeUnitIndicatorDoc(unitId);
        this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
      }
    });

    // Событие received:device:data - получены данные от плагина
    this.holder.on('received:device:data', getObj => {
      // TODO Только передать для обработки на worker
      /*
      const accepted = [];
      Object.keys(getObj).forEach(did => {
        if (did && this.devSet[did]) {
          accepted.push(...this.devSet[did].acceptData(getObj[did]));
        } else {
          console.log('ERROR: received:device:data. Device not found ' + did);
        }
      });

      if (accepted.length) {
        this.agent.emitDeviceDataAccepted(accepted);
      }
      */
    });

    // Событие accepted:device:data - данные приняты на уровне устройства 
    // TODO От worker-а  - нужно сохранить в свой  devSet!!
    this.holder.on('accepted:device:data', accepted => {
      const changed = accepted.filter(item => item && item.changed);
      if (changed.length) {
        this.holder.emit('changed:device:data', changed);
      }
    });

  }

  getHandlerForType(type, event) {
    return typestore.getHandlerFun(type, '_' + event);
  }

  
  

  /**
   * Формирует структуры для запуска обработчиков
   * Вызывается при добавлении/ редактировании/удалении типа
   * @param {Array of Objects} - arr  Массив новых документов или изменений
   *
   */
  formTypeHandlerSets(arr) {
   // TODO - на worker
  }

 

  /**
   * Добавить новое устройство (или полностью заменить??)
   *
   * @param {*} doc - запись из таблицы
   * @param {*} dataObj - сохраненные значения динамических свойств
   * @param {*} chanObj - привязки к каналам из devhard
   */
  addDevice(doc, dataObj, chanObj) {
    if (doc.dn) {
      this.devSet[doc._id] = devfactory.create(doc, dataObj, chanObj);
      this.dnSet[doc.dn] = this.devSet[doc._id]; // Объект устройства для обращения по dn, свойства плоские
      this.worker.postMessage({name:'add:device', data: this.devSet[doc._id]})
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
    // TODO -> worker
  }

  getDevice(did) {
    return this.devSet[did];
  }

  hasDevice(did) {
    return !!this.devSet[did];
  }

  setChannelLink(did, prop, upDoc) {
    if (!this.devSet[did]) return;
    deviceutil.setChannel(this.devSet[did], prop, upDoc)
    // TODO -> worker
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    deviceutil.clearChannel(this.devSet[did], prop)
    // TODO -> worker
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
    this.dnSet[olddn] = null;
    // TODO -> worker
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


