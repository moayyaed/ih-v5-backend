/**
 * devicemanager.js
 */

const util = require('util');

const Devo = require('./devo');
const dbstore = require('../dbs/dbstore');
// const hut = require('../utils/hut');

const dm = require('../datamanager');
const typestore = require('../dbs/typestore');


class DeviceManager {
  async start() {
    await this.createDevSet();

    // Слушать события изменения таблиц, связанных с устройствами и типами
    dm.on('inserted:device', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
    });

    dm.on('updated:device', docs => {
      if (!docs || !docs.length) return;
      // Изменены устройства - изменить в devSet, возможно изменение dn!
  
      console.log('update:device ' +util.inspect(docs));
      docs.forEach(doc => {
        if (doc.$set && doc.$set.dn) {
          typestore.updateDnPref(doc.$set.dn);
          // TODO В связи с изменением dn - ???
        }
      });
      // Приходят только изменения. Существенные? И предыдущая запись для сравнения?
      console.log('EMIT: devices has updated! ' + docs);
    });

    dm.on('removed:device', docs => {

      // Удалены устройства - удалить из devSet и возможно еще где-то
      if (!docs || !docs.length) return;
   
      console.log('removed:device ' +util.inspect(docs));
      docs.forEach(doc => {
        if (doc.dn) {
          typestore.deleteDnPref(doc.dn);
          // TODO В связи с изменением dn - ???
        }
      });
      console.log('EMIT: devices has removed! ' + docs);
    });

    // и с типами
    dm.on('inserted:type', docs => {
      // Добавлен новый тип - просто добавить в typeMap новые записи
      docs.forEach(item => typestore.addItem(item));
    });

    dm.on('updated:type', docs => {
      console.log('updated:type '+util.inspect(docs))
      // Изменен тип (типы)
      //  - изменить в typeMap
      //  Возможно, нужно менять все устройства этого типа??
      docs.forEach(doc => {
        // Если изменилось название, префикс
        if (doc.$set && (doc.$set.name || doc.$set.ruledn_pref )) {
          typestore.updateItem(doc._id, doc.$set);
        }
      });
    });

    dm.on('removed:type', docs => {
      // Удалены типы - устройств уже быть не должно, просто удалить из typeMap
      docs.forEach(doc => typestore.deleteItem(doc._id));
    });
  }

 

  async createDevSet() {
    this.devSet = {};
    this.devMap = new Map();
  /*
    // Получить список устройств из таблицы devices, создать devSet и devMap
    const devices = await dbstore.get('devices', {}, {});
    devices.forEach(item => {
      this.devSet[item.dn] = new Devo(item, this.typeMap.get(item.type));
      this.devMap.set(item._id, item.dn);
    });

    // Загрузить значения параметров и дополнительных свойств в devSet
    const devprops = await dbstore.get('devprops', {}, {});
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
}

module.exports = new DeviceManager();
