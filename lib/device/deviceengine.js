/**
 * deviceengine.js
 */
const util = require('util');
// const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

const Devo = require('./devo');

class Deviceengine {
  constructor(holder) {
    this.holder = holder;
  }

  start(devDocs, typestore) {
    this.devSet = {};
    this.devMap = new Map();

    this.createDevSet(devDocs, typestore);
    this.holder.devSet = this.devSet;

    // console.log('this.devSet = ' + util.inspect(this.devSet));

    this.holder.on('get:device:data', getObj => {
      const changed = [];
      // console.log('get:device:data getObj='+util.inspect(getObj))
      Object.keys(getObj).forEach(did => {
        if (this.devMap.has(did)) {
          const dn = this.devMap.get(did);
          changed.push(...this.devSet[dn].change(getObj[did]));
        } else console.log('Device not found: DID=' + did);
      });

      if (changed.length) {
        // console.log('changed:device:data ' + util.inspect(changed));
        this.holder.emit('changed:device:data', changed);
      }
    });
  }

  createDevSet(deviceDocs) {
    // Получить список устройств из таблицы devices, создать devSet и devMap

    deviceDocs.forEach(item => {
      if (item.dn) {
        // console.log('devDoc ' +util.inspect(item));
        this.devSet[item.dn] = new Devo(item, this.typestore);
        // console.log(item.dn +util.inspect(devSet[item.dn]));
        this.devMap.set(item._id, item.dn);
        // console.log( util.inspect(this.devSet[item.dn]));
      } else {
        console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
      }
    });
  }
}

module.exports = Deviceengine;
