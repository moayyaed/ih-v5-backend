/**
 * load.js
 * Загрузка данных на старте
 *
 *  - Загружает типы (holder.typeMap)
 *  - Формирует и возвращает структуры устройств (с привязкой к каналам и сохраненным значениям)
 *
 *
 */

const util = require('util');

const device_struct = require('./device_struct');
const typestore = require('./typestore');
const deviceutil = require('./deviceutil');
const devicelogger = require('./devicelogger');
const Globalman = require('./globalmanager');
const Traco = require('./traco');

module.exports = async function(holder) {
  const dm = holder.dm;
  holder.global = new Globalman(holder);
  devicelogger.start(holder);

  // Устройства и типы
  const typeDocs = (await dm.dbstore.get('types')).filter(doc => !doc.folder);
  const deviceDocs = (await dm.dbstore.get('devices', {}, { order: 'dn' })).filter(doc => !doc.folder);

  // Устройства нужны в typestore чтобы построить систему автоматического именованая
  typestore.start(typeDocs, deviceDocs, dm);
  holder.typeMap = typestore.getTypeMap();

  // Добавить системные устройства - они создаются на лету
  const sysdevs = await formSysdeviceArray();
  deviceDocs.push(...sysdevs);

  // Считать каналы
  const devChannels = await getChannelsFromDevhard();

  // Сохраненные значения вытащить из devparam + devcurrent
  const devData = {};
  await getCurrentData('devcurrent');
  await getCurrentData('devparam');

  // Создать устройства, заполнить значения свойств сохраненными, фиксировать привязку к каналам
  const devStructSet = {};

  deviceDocs.forEach(item => {
    if (item.dn) {
      devStructSet[item._id] = device_struct.create(item, holder.typeMap, devData[item._id], devChannels[item._id]);
      devicelogger.addFirst(item._id, devData[item._id]);
    } else {
      console.log('WARN: devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  });

  // Заполнить список обработчиков типов 
  fillTypeTraceSet();

  // Заполнить глобальные переменные
  await fillGlobal();
  // Заполнить список обработчиков глобальных переменных
 
  return devStructSet;

  // Системные устройства - индикаторы создаются на лету
  // - Добавить индикатор(ы) БД
  // - Добавить индикаторы плагинов
  async function formSysdeviceArray() {
    const res = [];
    
    // Создать индикатор основного процесса
    const mainObj = deviceutil.createUnitIndicatorDoc('mainprocess');
    res.push(mainObj);

     // Создать индикатор logagent
     const logSysObj = deviceutil.createUnitIndicatorDoc('logagent');
     res.push(logSysObj);

    // Создать индикатор dbagent - Историческая БД
    const dbSysObj = deviceutil.createUnitIndicatorDoc('dbagent');
    res.push(dbSysObj);


    const unitDocs = await dm.dbstore.get('units', {});
    for (const doc of unitDocs) {
      if (!doc.folder && doc.plugin && doc._id) {
        res.push(deviceutil.createUnitIndicatorDoc(doc._id));
      }
    }
    return res;
  }

  // Формировать devChannels - для одного устройства м б несколько записей с каналами - для отдельных свойств
  async function getChannelsFromDevhard() {
    const res = {};
    const docs = await dm.dbstore.get('devhard', {}, {});
    docs.forEach(doc => {
      // {"_id":"U80UL_Pce","unit":"emuls1","desc":"DI","period":"10","did":"d0007","prop":"value","chan":"emul002", "w":1, "r":1}
      const { did, prop } = doc;
      if (did && prop) {
        if (!res[did]) res[did] = {};
        res[did][prop] = doc;
      }
    });
    return res;
  }

  async function getCurrentData(table) {
    const docs = await dm.dbstore.get(table);
    docs.forEach(doc => {
      // {_id:'d0003.auto', val:1, ts, src}
      const [did, prop] = doc._id.split('.');
      if (did && prop) {
        if (!devData[did]) devData[did] = {};
        devData[did][prop] = doc;
      }
    });
  }


  // Выбрать все пользовательские обработчики
  // Из свойств - с fuse=2
  function fillTypeTraceSet() {
    for (let [type, typeObj] of holder.typeMap) {
      // По свойствам - если fuse = 2?
      Object.keys(typeObj.props).forEach(prop => {
        if (typeObj.props[prop].fuse == 2 && typeObj.props[prop].handler) {
          const hanid = type + '_' + prop;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.props[prop].handler, 'type');
        }
        if (typeObj.props[prop].format == 2 && typeObj.props[prop].formathandler) {
          const hanid = type + '__format_' + prop;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.props[prop].formathandler, 'type');
        }
      });

      // Верхнего уровня - они все пользовательские
      Object.keys(typeObj.onHandlers).forEach(event => {
        if (typeObj.onHandlers[event].filename) {
          const hanid = type + '_' + event;
          holder.traceSet[hanid] = new Traco(hanid, typeObj.onHandlers[event], 'type');
        }
      });
    }
  }

  async function fillGlobal() {
    // Глобальные переменные - их тоже нужно сохранять и восстанавливать из glcurrent
    // Выбрать текущее значение
    const docs = await dm.dbstore.get('glcurrent');
    const glData = {};
    docs.forEach(doc => {
      glData[doc._id] = doc;
    });

    const glDocs = (await dm.dbstore.get('globals')).filter(doc => !doc.folder);
    glDocs.forEach(doc => {
      holder.global.addItem(doc._id, doc, glData[doc._id]);
      // Если есть обработчик - добавить его 
      if (doc.scriptOnChange) {
        holder.traceSet[doc._id] = new Traco(doc._id, {}, 'global');
      }
    });
  }


};
