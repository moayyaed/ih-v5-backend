/**
 * devicemanager.js
 * Объект для работы с устройствами
 *  - загружает устройства, строит структуры для оперативной работы devSet, devMap
 *  - имеет функционал для обработка массива изменения данных устройств(запускается событием поступлени данных)
 *  - изменяет devSet, devMap при изменении настроек (добавление, удаление, изменение типа)
 */

const util = require('util');

const Devo = require('./devo');

// const hut = require('../utils/hut');

const dm = require('../datamanager');
const typestore = require('./typestore');

const devSet = {};
const devMap = new Map();

module.exports = {
  async start() {
    // загрузка данных в typestore - типы и префиксы device
    const typeDocs = await dm.dbstore.get('types', {}, {});
    const deviceDocs = await dm.dbstore.get('devices', {}, { order: 'dn' });
    typestore.start(typeDocs, deviceDocs, dm);

    console.log('typestore ' + util.inspect(typestore));

    this.createDevSet(deviceDocs);

    // Слушать события изменения таблиц, связанных с устройствами и типами
    dm.on('inserted:device', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
    });

    dm.on('updated:device', docs => {
      if (!docs || !docs.length) return;
      // Изменены устройства - изменить в devSet, возможно изменение dn!

      console.log('update:device ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.$set && doc.$set.dn) {
          // TODO В связи с изменением dn - ???
        }
      });
      // Приходят только изменения. Существенные? И предыдущая запись для сравнения?
      console.log('EMIT: devices has updated! ' + docs);
    });

    dm.on('removed:device', docs => {
      // Удалены устройства - удалить из devSet и возможно еще где-то
      if (!docs || !docs.length) return;

      console.log('removed:device ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.dn) {
          // TODO В связи с изменением dn - ???
        }
      });
      console.log('EMIT: devices has removed! ' + docs);
    });
  },

  async createDevSet(deviceDocs) {
    // Получить список устройств из таблицы devices, создать devSet и devMap

    deviceDocs.forEach(item => {
      if (item.dn) {
        // console.log('devDoc ' +util.inspect(item));
        devSet[item.dn] = new Devo(item, typestore);
        // console.log(item.dn +util.inspect(devSet[item.dn]));
        devMap.set(item._id, item.dn);
      } else {
        console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
      }
    });

    /*
    // Загрузить значения параметров и дополнительных свойств в devSet
    const devprops = await dm.dbstore.get('devprops', {}, {});
    devprops.forEach(item => {
      // item = {_id:"", "aux":[{prop:"value", "mu":"","db":1,..}, {prop:"setpoint",..}]}
      const dn = this.devMap.get(item._id);
      const dobj = this.devSet[dn];
      if (item.aux && Array.isArray(item.aux)) {
        item.aux.forEach(aitem => {
          // Проверить, что устройство имеет это основное свойство, добавить все поля из файа
          if (dobj[aitem.prop] != undefined) {
            dobj.setAuxPropsFromObj(aitem.prop, aitem);
          }
        });
      }
    });
   
    // Загрузить текущие сохраненные значения
    const devcurrent = await dbstore.get('devcurrent', {}, {});
    devcurrent.forEach(item => {
      // item = {_id:"", "raw":[{prop:"value", val, ts, src}, {prop:"setpoint",val, ts, src}]}
      const dn = this.devMap.get(item._id);
      const dobj = this.devSet[dn];
      if (item.raw && Array.isArray(item.raw)) {
        item.raw.forEach(pitem => {
          // Проверить, что устройство имеет это основное свойство, добавить
          if (dobj[pitem.prop] != undefined) {
            dobj.setRawPropsFromObj(pitem.prop, pitem);
          }
        });
      }
      console.log(util.inspect(dobj));
    });
    */

    console.log();
    // Вычислить вычисляемые поля
  }
};
