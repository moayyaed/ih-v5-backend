/**
 * deviceengine_main.js
 * Работает с устройствами на стороне основного процесса
 * Редактирование
 *  - добавление/удаление/изменение устройств и типов
 *  - передать сообщение об изменениях воркеру
 *
 * Оперативная работа
 *  - обмен сообщениями с deviceWorker (received:device:data => accepted:device:data<=)
 *  - Сохранение данных устройств и ведение журналов
 */

const util = require('util');

const hut = require('../utils/hut');
// const appconfig = require('../appconfig');
const device_struct = require('./device_struct');
const type_struct = require('./type_struct');
const deviceutil = require('./deviceutil');
const devicelogger = require('./devicelogger');

const typestore = require('./typestore');
const Typo = require('./typo');
const Basedevo = require('./basedevo');

class Deviceengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    this.devSet = holder.devSet; // key= _id (did) devSet Уже сформирован в load
    this.dnSet = holder.dnSet; // key = dn,
    this.typeMap = typestore.getTypeMap();
  }

  start() {
    // Сохранить в Журнал присвоение дефолтных значений глобальным переменным на старте
    this.logGlobalDef();

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
      this.holder.deviceWorker.postMessage({ name: 'received:device:data', data: getObj });
    });

    // Все как у устройств
    this.holder.emit('received:globals', getObj => {
      this.holder.deviceWorker.postMessage({ name: 'received:globals', data: getObj });
    });

    // **********   События Worker-а  транслируются также через holder? **************
    this.holder.on('accepted:globals', accepted => {
      console.log('MAIN accepted:globals ' + accepted);
      this.complyGlobal(accepted);

      // Их нужно принять и генерировать событие changed:
      this.holder.emit('changed:globals', accepted); // Для webservera
    });

    this.holder.on('accepted:device:data', accepted => {
      // Событие accepted:device:data - данные приняты на уровне устройства

      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' accepted FROM WORKER: ' + util.inspect(accepted));

      // this.holder.emit('accepted:device:data', accepted);  // Для трендов, которые пишут все подряд
      const changed = accepted.filter(item => item && item.changed);
      if (changed.length) {
        this.holder.emit('changed:device:data', changed);

        // comply  - признать полученные значения - берем только изменения
        this.complyDevice(changed);
      }
    });

    this.holder.on('log:device:mainlog', logObj => {
      this.holder.logconnector.addLog('mainlog', logObj);
    });

    this.holder.on('log:device:devicelog', logObj => {
      if (logObj.did) devicelogger.addLog(logObj.did, logObj);
    });
  }

  complyDevice(changed) {
    const devparam = [];
    const devcurrent = [];

    changed.forEach(item => {
      if (item.did && this.devSet[item.did]) {
        // Сохранить значение в basedevo
        const { did, prop, ts, val, prev, raw, param, txt } = this.devSet[item.did].comply(item);

        // Запись а таблицы текущих значений

        if (did && prop) {
          const toSave = { _id: did + '.' + prop, did, prop, ts, val, prev, raw };

          if (param) {
            devparam.push(toSave);
          } else {
            devcurrent.push(toSave);
          }
          // Запись в devicelog
          devicelogger.addLog(did, { did, prop, ts, val, txt });
        }
      }
    });
    if (devparam.length) this.dm.upsertDocs('devparam', devparam);
    if (devcurrent.length) this.dm.upsertDocs('devcurrent', devcurrent);
  }

  complyGlobal(changed) {
    // { did, ts, value, sender }
    const glcurrent = [];
    changed.forEach(item => {
      const did = item.did;
      if (did) {
        const logObj = this.holder.global.comply(item);
        if (this.holder.global.needSaveToLog(did)) {
          // Запись в devicelog
          this.holder.logconnector.addLog('devicelog', { ...logObj });
        }
        if (this.holder.global.needSaveToCurrent(did)) {
          glcurrent.push({ _id: did, ...logObj });
        }
      }
    });
    if (glcurrent.length) this.dm.upsertDocs('glcurrent', glcurrent);
  }

  getDevice(did) {
    return this.devSet[did];
  }

  hasDevice(did) {
    return !!this.devSet[did];
  }

  getTypeObj(typeId) {
    const typeObj = this.typeMap.get(typeId);
    if (!typeObj) {
      console.log('ERROR: changeTypeFlatFields. Missing type with id=' + typeId);
      throw { message: 'Not found type ' + typeId };
    }
    return typeObj;
  }

  // ----------------   Функции изменения типа ----------------
  addType(doc) {
    if (!doc || !doc._id) return;
    const typeId = doc._id;
    const t_struct = type_struct.create(doc);
    this.typeMap.set(typeId, new Typo(t_struct));
    this.holder.deviceWorker.postMessage({ name: 'add:type', data: t_struct });
  }

  removeType(doc) {
    if (!doc || !doc._id) return;
    const typeId = doc._id;
    this.typeMap.delete(typeId);
    this.holder.deviceWorker.postMessage({ name: 'remove:type', data: { typeId } });
  }

  changeTypeFlatFields(typeId, chobj) {
    const typeObj = this.getTypeObj(typeId);
    typeObj.changeFlatFields(chobj);
    this.holder.deviceWorker.postMessage({ name: 'update:type:flat', data: { typeId, chobj } });
  }

  changeTypeProps(typeId, chobj) {
    const typeObj = this.getTypeObj(typeId);
    typeObj.changeProps(chobj);
    this.holder.deviceWorker.postMessage({ name: 'update:type:props', data: { typeId, chobj } });
  }

  changeTypeHandler(typeId, filename) {
    hut.unrequire(filename);
    this.holder.deviceWorker.postMessage({ name: 'update:type:handler', data: { typeId, filename } });
  }

  setScriptBlk(scriptName, val) {
    // Имя обработчика (или сценария??) - вытащить тип и prop
    // Для типа  - установить флаг блокировки в handlerobj
    const arr = scriptName.split('_');
    if (arr && arr.length > 1) {
      // t002_state
      // intra@termostat_state
      // intra@termostat__OnChange
      // intra@termostat_format_state_animation

      const typeId = arr[0];
      const typeObj = this.getTypeObj(typeId);
      if (!typeObj) {
        console.log('ERROR: Not found type ' + typeId + ' for handler ' + scriptName);
        return;
      }

      arr.splice(0, 1);
      const prop = arr.join('_');
      console.log('setScriptBlk type=' + typeId + ' prop=' + prop);
      typeObj.setHandlerBlk(prop, val);
    }
  }

  // ----------------   Функции изменения глобальных переменных ----------------
  // Добавлена новая переменная
  addGlobal(doc) {
    if (!doc || !doc._id) return;
    const did = doc._id;
    const data = this.holder.global.addItem(did, doc);
    this.holder.deviceWorker.postMessage({ name: 'add:global', data });
  }

  updateGlobal(doc) {
    if (!doc || !doc._id) return;

    const did = doc._id;
    this.holder.global.updateItem(did, doc);
    const chobj = this.holder.global.getItem(doc._id);
    console.log('updateGlobal ' + did + ' ' + util.inspect(chobj));
    this.holder.deviceWorker.postMessage({ name: 'update:global', data: { did, chobj } });
  }

  removeGlobal(doc) {
    if (!doc || !doc._id) return;
    const did = doc._id;
    this.holder.global.removeItem(did);
    this.holder.deviceWorker.postMessage({ name: 'remove:global', data: { did } });
  }

  // ----------------  Функции изменения устройства ----------------
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
      this.holder.deviceWorker.postMessage({ name: 'add:device', data: dev_struct });
    } else {
      console.log('WARN: devices._id = ' + doc._id + '. NO dn! SKIPPED doc: ' + util.inspect(doc));
    }
  }

  removeDevice(doc) {
    if (!doc || !doc._id) return;

    // Отправить на worker
    this.holder.deviceWorker.postMessage({ name: 'remove:device', data: { did: doc._id } });
    if (this.devSet[doc._id]) {
      const dn = this.devSet[doc._id].dn;
      if (dn) delete this.dnSet[dn];
      delete this.devSet[doc._id];
    }
  }

  // chobj: { _id, unit, chan };
  setChannelLink(did, prop, chobj) {
    if (!this.devSet[did]) return;
    this.devSet[did].setChannel(prop, chobj);
    this.holder.deviceWorker.postMessage({ name: 'update:device:setchannel', data: { did, prop, chobj } });
  }

  clearChannelLink(did, prop) {
    if (!this.devSet[did]) return;
    this.devSet[did].clearChannel(prop);
    this.holder.deviceWorker.postMessage({ name: 'update:device:clearchannel', data: { did, prop } });
  }

  // Изменили dn устройства
  changeDeviceDn(did, olddn, newdn) {
    if (this.devSet[did]) {
      this.devSet[did].dn = newdn;
      this.dnSet[newdn] = this.devSet[did];
    }
    this.dnSet[olddn] = null;
    this.holder.deviceWorker.postMessage({ name: 'update:device:dn', data: { did, olddn, newdn } });
  }

  // Изменение других плоских полей
  changeDeviceFields(did, chobj) {
    if (!this.devSet[did] || !chobj) return;
    this.holder.deviceWorker.postMessage({ name: 'update:device:flat', data: { did, chobj } });
    this.devSet[did].changeFlatFields(chobj);
  }

  // Изменили тип устройства
  changeDeviceType(did, type, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.holder.deviceWorker.postMessage({ name: 'update:device:type', data: { did, type, addProps, deleteProps } });

      this.devSet[did].changeType(type, addProps, deleteProps);
      this.holder.deviceWorker.postMessage({ name: 'reset:device:data', data: { did } });
    }
  }

  // Изменился сам тип (набор свойств)
  changeDeviceProps(did, addProps, deleteProps) {
    if (this.devSet[did]) {
      this.holder.deviceWorker.postMessage({ name: 'update:device:props', data: { did, addProps, deleteProps } });

      this.devSet[did].changeTypeProps(addProps, deleteProps);
      this.holder.deviceWorker.postMessage({ name: 'reset:device:data', data: { did } });
    }
  }

  changeDeviceAux(did, auxArr) {
    if (!this.devSet[did] || !auxArr || !auxArr.length) return;

    this.holder.deviceWorker.postMessage({ name: 'update:device:aux', data: { did, auxArr } });
    this.devSet[did].updateAuxArray(auxArr);
    this.holder.deviceWorker.postMessage({ name: 'reset:device:data', data: { did } });
    // Пересчитанные значения придут штатно через accept:device:data
  }

  // При сбросе привязки к каналу - сбросить значение на дефолтное - ГДЕ ИСП?
  resetValueWithDefault(did, prop) {
    if (!this.devSet[did]) return;
    this.holder.emit('received:device:data', { [did]: { [prop]: 0 } });
  }

  // Сохранить в Журнал присвоение дефолтных значений глобальным переменным на старте
  logGlobalDef() {
    const toSave = [];
    Object.keys(this.holder.global.glByDid).forEach(did => {
      const item = this.holder.global.glByDid[did];
      // if (item.save && item.setdef) {
      if (item.save) toSave.push({did, val:item.value, ts:item.ts});
      
    });
    if (toSave.length)  this.holder.logconnector.addLog('devicelog', toSave);
  }
}

module.exports = Deviceengine;
