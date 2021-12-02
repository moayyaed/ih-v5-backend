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
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');
const device_struct = require('./device_struct');
const type_struct = require('./type_struct');
const deviceutil = require('./deviceutil');
const devicelogger = require('./devicelogger');
const logconnector = require('../log/logconnector');
const dbconnector = require('../dbconnector');

const typestore = require('./typestore');
const Typo = require('./typo');
const Basedevo = require('./basedevo');
const Traco = require('./traco');

class Deviceengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    this.devSet = holder.devSet; // key= _id (did) devSet Уже сформирован в load
    this.dnSet = holder.dnSet; // key = dn,
    this.typeMap = typestore.getTypeMap();

    this.sceneExtprops = {};
    holder.sceneExtprops = this.sceneExtprops;
  }

  start() {
    // Сохранить в Журнал присвоение дефолтных значений глобальным переменным на старте
    this.logGlobalDef();

    //  Создать системный индикатор  Возможно, он уже создан - тогда не создавать
    // Собщение от pluginengine
    this.holder.on('create:unitIndicator', (unitId, unitInfo) => {
      this.createUnitIndicator(unitId, unitInfo);
    });

    // Удалить системный индикатор
    this.holder.on('remove:unitIndicator', unitId => {
      this.removeUnitIndicator(unitId);
    });

    // received:device:data - получены данные от плагина
    this.holder.on('received:device:data', getObj => {
      // Только передать для обработки на worker
      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + ' received:device:data TO WORKER: ' + util.inspect(getObj));
      this.holder.deviceWorker.postMessage({ name: 'received:device:data', data: getObj });
    });

    // received:globals - Все как у устройств
    this.holder.on('received:globals', getObj => {
      // console.log(hut.getDateTimeFor(new Date(), 'shortdtms') + 'received:globals TO WORKER: ' + util.inspect(getObj));
      this.holder.deviceWorker.postMessage({ name: 'received:globals', data: getObj });
    });

    // schedule:ready - Сигнал запуска обработчиков по расписанию
    this.holder.on('schedule:ready', (tname, triggers) => {
      this.holder.deviceWorker.postMessage({ name: 'schedule:ready', data: { tname, triggers } });
    });

    this.holder.on('deletelog:device', (did) => {
      devicelogger.deleteLog(did);
    });

    // **********   События Worker-а  транслируются также через holder? **************
    this.holder.on('accepted:globals', accepted => {
      // console.log('MAIN accepted:globals ' + util.inspect(accepted));
      this.complyGlobal(accepted);

      // Их нужно принять и генерировать событие changed:
      this.holder.emit('changed:globals', accepted); // Для webservera
    });

    this.holder.on('accepted:device:data', accepted => {
      // Событие accepted:device:data - данные приняты на уровне устройства
      this.complyDevice(accepted); // comply  - признать полученные значения

      const changed = accepted.filter(item => item && item.changed);
      if (changed.length) {
        this.holder.emit('changed:device:data', changed);
      }
    });

    this.holder.on('log:device:mainlog', logObj => {
      logconnector.addLog('mainlog', logObj);
    });

    this.holder.on('log:device:devicelog', logObj => {
      // console.log('MAIN log:device:devicelog logObj='+util.inspect(logObj))
      if (logObj.did) devicelogger.addLog(logObj.did, logObj);
    });

    this.holder.on('add:extprops:scene', data => {
      //  this.wCore.postMessage('add:extprops:scene', {sceneId:id, extpropsByDn:{<dn>:[{name,...}]} });
      const { extpropsByDn, sceneId } = data;
      if (!extpropsByDn || !sceneId) return;

      Object.keys(extpropsByDn).forEach(dn => {
        // Добавить устройству
        const devExtProps = extpropsByDn[dn];
        const dobj = this.holder.dnSet[dn];
        if (dobj) dobj.addExtProps(devExtProps, sceneId);

        // Добавить в общий список расширенных свойств - каждое свойство отдельно
        if (!this.sceneExtprops[sceneId]) this.sceneExtprops[sceneId] = {};
        if (!this.sceneExtprops[sceneId][dn]) this.sceneExtprops[sceneId][dn] = {};
        devExtProps.forEach(item => {
          const prop = item.name;
          this.sceneExtprops[sceneId][dn][prop] = { ...item };
        });
      });
    });

    this.holder.on('remove:extprops:scene', data => {
      //  this.wCore.postMessage('remove:extprops:scene', {sceneId:id, extpropsByDn:{<dn>:1} });
      const { extpropsByDn, sceneId } = data;
      if (!extpropsByDn || !sceneId) return;

      // Удалить из списка расширенных свойств -  в целом для сценария
      if (this.sceneExtprops[sceneId]) this.sceneExtprops[sceneId] = '';

      // Удалить в устройствах
      Object.keys(extpropsByDn).forEach(dn => {
        const dobj = this.holder.dnSet[dn];
        if (dobj) dobj.deleteExtProps(sceneId);
      });
    });

    // Пришла команда на запись в БД от worker - обработчик или сценарий
    this.holder.on('dbwrite', data => {
      if (!data.toWrite) return;
      dbconnector.write(data.toWrite);
    });
  }

  createUnitIndicator(unitId, { parent, version }) {
    const id = deviceutil.getUnitIndicatorId(unitId);
    if (!this.hasDevice(id)) {
      this.addDevice(deviceutil.createUnitIndicatorDoc(unitId));
      this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
    }
    if (this.devSet[id]) {
      if (parent) this.devSet[id].parent = parent;
      if (version) this.devSet[id].comply({ did: id, prop: 'version', value: version });
    }
  }

  removeUnitIndicator(unitId) {
    const id = deviceutil.getUnitIndicatorId(unitId);
    if (this.hasDevice(id)) {
      this.removeDevice({ _id: id });
      deviceutil.removeUnitIndicatorDoc(unitId);
      this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
    }
  }

  complyDevice(accepted) {
    const devparam = [];
    const devcurrent = [];

    accepted.forEach(item => {
      if (item.did && this.devSet[item.did]) {
        const complyRes = this.devSet[item.did].comply(item);
        if (!complyRes || !complyRes.did || !complyRes.prop) return; // Изменений нет

        const { did, prop, save, ts, cts, val, prev, prevcts, raw, param, txt, fval, err } = complyRes;

        // Запись в devicelog - только если есть флаг save
        // пишем отформатированное значение
        if (save) {
          const value = fval != undefined ? fval : val;
          devicelogger.addLog(did, { did, prop, ts, val: value, txt, err });
        }
        if (prop == 'error') return;

        // Стратегия сохранения измененного значения для восстановления после перезагрузки
        // Если save || param - сохранять всегда
        // Иначе не чаще чем раз в 15? секунд
        if (save || param || !prevcts || cts - prevcts > 15000) {
          const toSave = { _id: did + '.' + prop, did, prop, ts, val, prev, raw, err };
          if (param) {
            devparam.push(toSave);
          } else {
            devcurrent.push(toSave);
          }
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
          // logconnector.addLog('devicelog', { ...logObj });
          devicelogger.addLog(did,  { ...logObj });
          // Нужно удалять - оставить только 100 последних записей??
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

  // ----------------   Функции изменения типа - вызывает devicemate при изменении таблицы ----------------
  addType(doc) {
    if (!doc || !doc._id) return;
    const typeId = doc._id;
    const t_struct = type_struct.create(doc);
    this.typeMap.set(typeId, new Typo(t_struct));
    this.holder.deviceWorker.postMessage({ name: 'add:type', data: { typeId, typeObj: t_struct } });
  }

  removeType(doc) {
    if (!doc || !doc._id) return;
    const typeId = doc._id;
    this.typeMap.delete(typeId);
    this.holder.deviceWorker.postMessage({ name: 'remove:type', data: { typeId } });
  }

  changeTypeFlatFields(typeId, chobj) {
    const typeObj = this.getTypeObj(typeId);
    type_struct.changeFlatFields(typeObj, chobj);
    const tObj = type_struct.extract(typeObj);
    // В worker передать полностью измененную структуру
    this.holder.deviceWorker.postMessage({ name: 'update:type:flat', data: { typeId, typeObj: tObj } });
  }

  async changeTypeProps(typeId) {
    const typeObj = this.getTypeObj(typeId);
    const doc = await this.dm.findRecordById('type', typeId);
    if (!doc || !typeObj) {
      console.log('ERROR: Not found type ' + typeId);
      return;
    }
    const newprops = doc.props;
    // Нужно сформировать новую структуру и передать готовую структуру на worker
    // typeObj.changeProps(chobj);
    type_struct.updateProps(typeObj, newprops);
    const tObj = type_struct.extract(typeObj);

    this.holder.deviceWorker.postMessage({ name: 'update:type:props', data: { typeId, typeObj: tObj } });
  }

  // Изменено тело алерта для свойства
  async changeTypeAlerts(typeId, prop) {
    const typeObj = this.getTypeObj(typeId);
    const doc = await this.dm.findRecordById('type', typeId);
    if (!doc || !typeObj) {
      console.log('ERROR: Not found type ' + typeId);
      return;
    }
    const newalert = doc.alerts && doc.alerts[prop] ? doc.alerts[prop] : '';
    if (!newalert) return;

    type_struct.updateOneAlert(typeObj, prop, newalert);
    this.dm.emit('update:type:alerts', typeId, prop);
  }

  emitAddTypeAlerts(typeId, propArr) {
    // console.log('emitAddTypeAlerts add:type:alerts '+typeId+' propArr='+util.inspect(propArr))
    this.dm.emit('add:type:alerts', typeId, propArr);
  }

  emitRemoveTypeAlerts(typeId, propArr) {
    this.dm.emit('remove:type:alerts', typeId, propArr);
  }

  //
  changeTypeHandler(typeId, prop, filename, errstr) {
    const blk = errstr ? 1 : 0;
    // console.log('changeTypeHandler typeId=' + typeId + ' prop=' + prop + ' errstr=' + errstr + ' blk=' + blk);
    hut.unrequire(filename);

    // Установить значение blk в typeObj, traceSet
    const typeObj = this.getTypeObj(typeId);
    typeObj.setHandlerBlk(prop, blk);

    this.setBlkTraceItem(typeId + '_' + prop, blk, errstr);

    // на worker - в любом случае нужно перезагрузить скрипт
    this.holder.deviceWorker.postMessage({ name: 'update:type:handler', data: { typeId, prop, filename, blk } });
  }

  /**
   * Обработка обработчика переименованного свойства
   *  запускается для файла свойства: txxx_<prop>
   *   или обработчика формата txxx_format_<prop>. В этом случае oldProp, newProp = format_<prop>
   * @param {String} typeId
   * @param {String} oldProp
   * @param {String} newProp
   * @param {Number} use - флаг использования обработчика (fuse или format)
   */
  async processRenamedPropHandler(typeId, oldProp, newProp, use) {
    const hanid = typeId + '_' + oldProp;

    if (this.holder.traceSet[hanid]) {
      delete this.holder.traceSet[hanid];
    }
    const oldfilename = appconfig.getHandlerFilenameIfExists(hanid);
    if (!oldfilename) return;

    // Если есть - файл переименовать
    const filename = appconfig.getHandlerFilename(typeId + '_' + newProp);
    await fut.renameP(oldfilename, filename);
    if (use == 2) {
      // Пользовательский обработчик
      this.changeTypeHandler(typeId, newProp, filename, '');
    }
  }

  setBlkTraceItem(hanid, blk, error) {
    if (!this.holder.traceSet[hanid]) {
      this.holder.traceSet[hanid] = new Traco(hanid, { blk, error }, 'type');
    } else {
      this.holder.traceSet[hanid].blk = blk;
      this.holder.traceSet[hanid].error = error;
    }
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
    this.holder.global.addItem(did, doc);
    const data = this.holder.global.glByDid[did];
    this.holder.deviceWorker.postMessage({ name: 'add:global', data });
  }

  updateGlobal(doc, deletefromlog) {
    if (!doc || !doc._id) return;

    const did = doc._id;
    this.holder.global.updateItem(did, doc);
    const chobj = this.holder.global.getItem(doc._id);
    this.holder.deviceWorker.postMessage({ name: 'update:global', data: { did, chobj } });
    if (deletefromlog) devicelogger.deleteLog(did);
  }

  removeGlobal(doc) {
    if (!doc || !doc._id) return;
    const did = doc._id;
    this.holder.global.removeItem(did);
    this.holder.deviceWorker.postMessage({ name: 'remove:global', data: { did } });
    devicelogger.deleteLog(did);
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
    devicelogger.deleteLog(doc._id);
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
    chobj = this.devSet[did].changeFlatFields(chobj);
    this.holder.deviceWorker.postMessage({ name: 'update:device:flat', data: { did, chobj } });
   
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
      if (item.save) toSave.push({ did, val: item.value, ts: item.ts });
    });
    if (toSave.length) logconnector.addLog('devicelog', toSave);
  }
}

module.exports = Deviceengine;

