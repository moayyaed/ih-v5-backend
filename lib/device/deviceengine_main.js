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
const Basedevo = require('./basedevo');

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
      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' TO WORKER: ' + util.inspect(getObj));
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

        // comply  - признать полученные значения - берем только изменения
        this.comply(changed);
      }
    });

    this.holder.on('log:device:mainlog', logObj => {
      this.holder.logconnector.addLog('mainlog', logObj);
    });
  }

  comply(changed) {
    const devparam = [];
    const devcurrent = [];

    changed.forEach(item => {
      if (item.did && this.devSet[item.did]) {
        // Сохранить значение в basedevo
        const toSave = this.devSet[item.did].comply(item);

        // Запись а таблицы текущих значений
        if (toSave) {
          if (toSave.p) {
            devparam.push(toSave);
          } else {
            devcurrent.push(toSave);
          }
        }

        // Запись в devicelog
      }
    });
    if (devparam.length) this.dm.upsertDocs('devparam', devparam);
    if (devcurrent.length) this.dm.upsertDocs('devcurrent', devcurrent);
  }

  getDevice(did) {
    return this.devSet[did];
  }

  hasDevice(did) {
    return !!this.devSet[did];
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
      const dev_struct = device_struct.create(doc, this.typeMap, dataObj, chanObj);
      this.devSet[doc._id] = new Basedevo(dev_struct, this.typeMap);
      this.dnSet[doc.dn] = this.devSet[doc._id]; // Объект устройства для обращения по dn

      // Отправить на worker
      this.worker.postMessage({ name: 'add:device', data: dev_struct });
    } else {
      console.log('WARN: devices._id = ' + doc._id + '. NO dn! SKIPPED doc: ' + util.inspect(doc));
    }
  }

  removeDevice(doc) {
    if (!doc || !doc._id) return;

    // Отправить на worker
    this.worker.postMessage({ name: 'remove:device', data: { did: doc._id } });
    if (this.devSet[doc._id]) {
      const dn = this.devSet[doc._id].dn;
      if (dn) delete this.dnSet[dn];
      delete this.devSet[doc._id];
    }
  }

  // chobj: { _id, unit, chan };
  setChannelLink(did, prop, chobj) {
    if (!this.devSet[did]) return;
    // deviceutil.setChannel(this.devSet[did], prop, chobj);
    this.devSet[did].setChannel(prop, chobj);
    this.worker.postMessage({ name: 'update:device:setchannel', data: { did, prop, chobj } });
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    // deviceutil.clearChannel(this.devSet[did], prop);
    this.devSet[did].clearChannel(prop);
    this.worker.postMessage({ name: 'update:device:clearchannel', data: { did, prop } });
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
    this.dnSet[olddn] = null;
    this.worker.postMessage({ name: 'update:device:dn', data: { did, olddn, newdn } });
  }

  // Изменение других плоских полей
  changeDeviceFields(did, chobj) {
    if (!this.devSet[did] || !chobj) return;
    this.worker.postMessage({ name: 'update:device:flat', data: { did, chobj } });
    this.devSet[did].changeFlatFields(chobj);
  }

  // Изменили тип устройства
  changeDeviceType(did, type, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.worker.postMessage({ name: 'update:device:type', data: { did, type, addProps, deleteProps } });

      this.devSet[did].changeType(type, addProps, deleteProps);
      this.worker.postMessage({ name: 'reset:device:data', data: { did } });
    }
  }

  // Изменился сам тип (набор свойств)
  changeDeviceProps(did, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.worker.postMessage({ name: 'update:device:props', data: { did, addProps, deleteProps } });

      this.devSet[did].changeTypeProps(addProps, deleteProps);
      this.worker.postMessage({ name: 'reset:device:data', data: { did } });
    }
  }

  changeDeviceAux(did, auxArr) {
    if (!this.devSet[did] || !auxArr || !auxArr.length) return;

    this.worker.postMessage({ name: 'update:device:aux', data: { did, auxArr } });
    this.devSet[did].updateAuxArray(auxArr);
    this.worker.postMessage({ name: 'reset:device:data', data: { did } });
    // Пересчитанные значения придут штатно через accept:device:data
  }

  // При сбросе привязки к каналу - сбросить значение на дефолтное - ГДЕ ИСП?
  resetValueWithDefault(did, prop) {
    if (!this.devSet[did]) return;
    this.holder.emit('received:device:data', { [did]: { [prop]: 0 } });
  }
}

module.exports = Deviceengine;
