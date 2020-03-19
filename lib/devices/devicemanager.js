/**
 * devicemanager.js
 */

const util = require('util');

const Devo = require('./devo');
const dbstore = require('../dbs/dbstore');
const hut = require('../utils/hut');
const dm = require('../datamanager');

class DeviceManager {
  async start() {
    // Сформировать typeMap из таблицы types :{_id:тип, props:{value:{vtype, op, min, max,...}}}
    this.typeMap = new Map();

    const data = await dbstore.get('types', {}, {});

    data.forEach(item => this.addToTypeMap(item)); // props преобразуется в массив свойств

    /*
    await this.createDevSet();
    */

    // Слушать события изменения таблиц, связанных с устройствами
    dm.on('insert:devices', (docs) => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
    });

    dm.on('update:devices', (docs) => {
      // Изменены устройства - изменить в devSet, возможно изменение dn!
      // Приходят только изменения. Существенные? И предыдущая запись для сравнения?  
      console.log('EMIT: devices has inserted! ' + docs);
    });

    dm.on('remove:devices', (docs) => {
       // Удалены устройства - удалить из devSet и возможно еще где-то
      console.log('EMIT: devices has removed! ' + docs);
    });

    // и с типами
    dm.on('insert:types', (docs) => {
      // Добавлен новый тип - просто добавить в typeMap
      console.log('EMIT: types has changed! ' + oper);
    });

    dm.on('update:types', (docs) => {
      // Изменен тип (типы)
      //  - изменить в typeMap
      //  Возможно, нужно менять все устройства этого типа 
      console.log('EMIT: types has changed! ' + oper);
    });

    dm.on('remove:types', (docs) => {
      // Удалены типы - устройств уже быть не должно, просто удалить из typeMap?
      
      console.log('EMIT: types has changed! ' + oper);
    });
  }

  addToTypeMap(item) {
    if (item.props) {
      this.typeMap.set(item._id, { item, proparr: hut.objectToArray(item.props, 'prop') });
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

  // Генерирует объект props для заданного типа устройства
  createPropsFromType(typeId) {
    const props = {};
    if (this.typeMap.has(typeId)) {
      const arr = this.typeMap.get(typeId).proparr;
      arr.forEach(propItem => {
        props[propItem.prop] = { db: propItem.db || 0 };
        if (propItem.vtype == 'N') {
          props[propItem.prop].min = propItem.min || null;
          props[propItem.prop].max = propItem.max || null;
          props[propItem.prop].dig = propItem.dig || 0;
        }
      });
    }
    return props;
  }

  // Генерирует новый dn для заданного типа устройства
  createDnFromType(typeId) {
    let res = 'XXXXX';
    if (this.typeMap.has(typeId)) {
      const typeItem = this.typeMap.get(typeId).item;
      if (typeItem.ruledn_pref) {
        res = typeItem.ruledn_pref+'001'; // нумерацию нужно получить из списка устройств
      } 
    }
    return res;
  }

  getNameFromType(typeId) {
    return this.typeMap.has(typeId) ? this.typeMap.get(typeId).item.name : '';
  }
}

module.exports = new DeviceManager();
