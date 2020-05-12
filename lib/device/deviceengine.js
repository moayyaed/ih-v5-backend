/**
 * deviceengine.js
 */
const util = require('util');
// const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
// const Timerman = require('../utils/timermanager');

const Devo = require('./devo');

class Deviceengine {
  constructor(holder, typestore) {
    this.holder = holder;
    this.typestore = typestore;
  }

  start(devDocs) {
   

    this.devSet = {}; // key= _id (did)
    this.dnSet = {}; // key = dn, 
    
    // this.createDevSet(devDocs, typestore);
    devDocs.forEach(item => {
      this.addDevice(item);
    });

    this.holder.devSet = this.devSet;
    this.holder.dnSet = this.dnSet;

    this.holder.on('get:device:data', getObj => {
      const changed = [];
      console.log('get:device:data getObj='+util.inspect(getObj))
      Object.keys(getObj).forEach(did => {
        console.log('get:device:data did='+did)
        if (this.devSet[did]) {
          changed.push(...this.devSet[did].change(getObj[did]));
        } else console.log('Device not found: DID=' + did);
      });

      if (changed.length) {
        // console.log('changed:device:data ' + util.inspect(changed));
        this.holder.emit('changed:device:data', changed);
      }
    });
  }

  addDevice(item) {
    if (item.dn) {
      this.devSet[item._id] = new Devo(item, this.typestore);
      this.dnSet[item.dn] =  this.devSet[item._id]; // Объект устройства для обращения по dn, свойства плоские
    } else {
      console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
    }
  }
 
  changeDeviceProps(did, addProps, deleteProps) {
    if (this.devSet[did]) this.devSet[did].changeTypeProps(addProps, deleteProps);
  }
  

}

module.exports = Deviceengine;
