/**
 * devicemanager.js
 */

const util = require('util');

const Devo = require('./devo');
const dbstore = require('../dbs/dbstore');
// const hut = require('../utils/hut');

class DeviceManager {
  async start() {
    // Сформировать typeMap из таблицы
    this.typeMap = new Map();
    const data = await dbstore.get('typeprops', {}, {});

    data.forEach(item => this.addToTypeMap(item));
    await this.createDevSet();
  }

  addToTypeMap(item) {
    if (item.type && item.prop) {
      if (!this.typeMap.has(item.type)) this.typeMap.set(item.type, new Map());
      this.typeMap.get(item.type).set(item.prop, item);
    }
  }

  async createDevSet() {
    this.devSet = {};
    this.devMap = new Map();

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

    console.log();
    // Вычислить вычисляемые поля
  }
}

module.exports = new DeviceManager();
