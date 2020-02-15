/**
 * devicemanager.js
 */

// const util = require('util');

const Devo = require('./devo');
const dbstore = require('../dbs/dbstore');
// const hut = require('../utils/hut');

class DeviceManager {
  async start() {
    // Сформировать typeMap из таблицы
    this.typeMap = new Map();
    const data = await dbstore.get('typeprops', {}, {});

    data.forEach(item => this.addToTypeMap(item));
  }

  addToTypeMap(item) {
    if (item.type && item.prop) {
      if (!this.typeMap.has(item.type)) this.typeMap.set(item.type, new Map());
      this.typeMap.get(item.type).set(item.prop, item);
    }
  }

  async createDevSet() {
    // Получить список устройств из таблицы devices
    const res = {};
    const devices = await dbstore.get('devices', {}, {});
    devices.forEach(item => {
      res[item.dn] = new Devo(item, this.typeMap.get(item.type) );
    });
    return res;
  }

  
}

module.exports = new DeviceManager();
