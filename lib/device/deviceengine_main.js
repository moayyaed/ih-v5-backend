/**
 * deviceengine_main.js
 * Работает с устройствами на стороне основного процесса
 *  - добавление/удаление/изменение устройств и типов
 *  - передать сообщение об изменениях воркеру
 *
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const device_struct = require('./device_struct');
const deviceutil = require('./deviceutil');

const typestore = require('./typestore');

class Deviceengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.worker = holder.deviceWorker;

    this.devSet = holder.devSet; // key= _id (did) devSet Уже сформирован в load
    this.dnSet = holder.dnSet; // key = dn,
    this.typeMap = typestore.getTypeMap();

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
      // Только передать для обработки на worker
      console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' TO WORKER: ' + util.inspect(getObj));
      this.worker.postMessage({ name: 'received:device:data', data: getObj });
    });

    // **********   События Worker-а  транслируются также через holder? **************
    this.holder.on('accepted:device:data', accepted => {
      // Событие accepted:device:data - данные приняты на уровне устройства
      
      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' accepted FROM WORKER: ' + util.inspect(accepted));

      // this.holder.emit('accepted:device:data', accepted);  // Для трендов, которые пишут все подряд
      const changed = accepted.filter(item => item && item.changed);
      if (changed.length) {
        this.holder.emit('changed:device:data', changed);
      }
      
      // comply  - признать полученные значения
      this.comply(accepted);
    });

  }

  comply(accepted) {
    if (!accepted || !accepted.length) return;
    accepted.forEach(item => {
      if (item.did && this.devSet[item.did]) this.devSet[item.did].comply(item);
    })
  }

  getHandlerForType(type, event) {
    return typestore.getHandlerFun(type, '_' + event);
  }

  /**
   * Формирует структуры для запуска обработчиков (отслеживание событий OnChange, ...)
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
      this.devSet[doc._id] = device_struct.create(doc, this.typeMap, dataObj, chanObj);
      this.dnSet[doc.dn] = this.devSet[doc._id]; // Объект устройства для обращения по dn, свойства плоские
      this.worker.postMessage({ name: 'add:device', data: this.devSet[doc._id] });
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
    deviceutil.setChannel(this.devSet[did], prop, upDoc);
    // TODO -> worker
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    deviceutil.clearChannel(this.devSet[did], prop);
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
    if (!this.devSet[did] || !auxArr || !auxArr.length) return;
    // Отправить на worker update:device:aux
    this.worker.postMessage({ name: 'update:device:aux', data: { did, auxArr } });

    // Изменить у себя
    this.devSet[did].updateAuxArray(auxArr);

    // Отправить на worker reset:device:data
    this.worker.postMessage({ name: 'reset:device:data', data: { did } });
    // Пересчитанные значения придут штатно через accept:device:data

    /*
    if (this.devSet[did] && auxArr) {
      auxArr.forEach(item => {
        this.devSet[did].updateAux(item.prop, item.auxprop, item.val);
      });
      // изменились свойства - пересчитать значения
      this.changeWithRaw(did);
    }
    */
  }

  changeWithRaw(did) {
    if (!this.devSet[did]) return;
    // Перепринять данные на базе значений raw
    const accepted = this.devSet[did].changeWithRaw();

    if (accepted.length) {
      // this.agent.emitDeviceDataAccepted(accepted);
    }
  }

  // При сбросе привязки к каналу - сбросить значение на дефолтное
  resetValueWithDefault(did, prop) {
    if (!this.devSet[did]) return;
    this.holder.emit('received:device:data', { [did]: { [prop]: 0 } });
  }
}

module.exports = Deviceengine;
