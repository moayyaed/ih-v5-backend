/**
 * deviceengine.js
 */
const util = require('util');
// const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

const Devo = require('./devo');


class Devengine {
  constructor(holder) {
    this.holder = holder;
  }

  start(devDocs, typestore) {
    this.devSet = {};
    this.devMap = new Map();

    this.createDevSet(devDocs, typestore);
    this.holder.devSet = this.devSet;
  }

  createDevSet(deviceDocs) {
    // Получить список устройств из таблицы devices, создать devSet и devMap

    deviceDocs.forEach(item => {
      if (item.dn) {
        // console.log('devDoc ' +util.inspect(item));
        this.devSet[item.dn] = new Devo(item, this.typestore);
        // console.log(item.dn +util.inspect(devSet[item.dn]));
        this.devMap.set(item._id, item.dn);
      } else {
        console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
      }
    });
  }
}

module.exports = Devengine;