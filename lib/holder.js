/**
 * holder.js
 */

// const util = require('util');
const EventEmitter = require('events');

// const appconfig = require('./appconfig');
const devman = require('./device/devicemanager');

class Holder extends EventEmitter {

  async start() {
    await devman.start();
  }

  getDevObj(dn) {
    return devman.devSet[dn];
  }

  getPlugin(unit) {
    return devman.devSet[unit];
  }

  addUnitSensor(item) {
    
  }

}


module.exports = new Holder();


/*
function Houser() {
  
  this.devSet = {};
  this.createDevSet();

  // Переменные сценариев передаются как объект global в каждый сценарий
  // this.globals = new Kvstore('globals');
}
*/
// util.inherits(Houser, require('events').EventEmitter);


// module.exports = Houser;