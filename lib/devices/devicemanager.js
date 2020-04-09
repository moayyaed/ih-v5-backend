/**
 * devicemanager.js
 */

const util = require('util');

const Devo = require('./devo');
const dbstore = require('../dbs/dbstore');
const hut = require('../utils/hut');
const dm = require('../datamanager');
const numerator = require('../dbs/numerator');

const DEFAULT_TYPE = 't100';

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
          numerator.updateDnPref(doc.$set.dn);
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
          numerator.deleteDnPref(doc.dn);
          // TODO В связи с изменением dn - ???
        }
      });
      console.log('EMIT: devices has removed! ' + docs);
    });

    // и с типами
    dm.on('inserted:type', docs => {
      // Добавлен новый тип - просто добавить в typeMap новые записи
      docs.forEach(item => this.addToTypeMap(item));
    });

    dm.on('updated:type', docs => {
      console.log('updated:type '+util.inspect(docs))
      // Изменен тип (типы)
      //  - изменить в typeMap
      //  Возможно, нужно менять все устройства этого типа??
      docs.forEach(doc => {
        // Если изменилось название, префикс
        if (doc.$set && (doc.$set.name || doc.$set.ruledn_pref )) {
          this.updateTypeMapItem(doc._id, doc.$set);
        }
      });

    });

    dm.on('removed:type', docs => {
      // Удалены типы - устройств уже быть не должно, просто удалить из typeMap?

    });
  }

  addToTypeMap(item) {
    if (item.props) {
      this.typeMap.set(item._id, { item, proparr: hut.objectToArray(item.props, 'prop') });
    }
  }

  updateTypeMapItem(id, newitem) {
    // {item: {_id, name, ruledn_pref}, proparr:[{ prop: 'value', name: 'Значение', vtype: 'B', op: 'r' },]
  
    const curItem =  this.typeMap.get(id).item;
  
    Object.assign( curItem, newitem);
   

    console.log('updateTypeMap RESULT: '+util.inspect(this.typeMap.get(id)));
    
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
    let pref = 'DN';
    if (this.typeMap.has(typeId)) {
      const typeItem = this.typeMap.get(typeId).item;
      if (typeItem.ruledn_pref) pref = typeItem.ruledn_pref; 
    }
    return numerator.getNewDn(pref);
  }

  getNameFromType(typeId) {
    return this.typeMap.has(typeId) ? this.typeMap.get(typeId).item.name : '';
  }

  createDeviceDoc(doc, type) {
    type = type || DEFAULT_TYPE;

    doc.props = this.createPropsFromType(type);
    doc.dn = this.createDnFromType(type);
    doc.name = this.getNameFromType(type);
    doc.type = type;
    return doc;
  }
}

module.exports = new DeviceManager();
