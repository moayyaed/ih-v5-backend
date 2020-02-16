/**
 * holder.js
 */

// const util = require('util');
const EventEmitter = require('events');

// const appconfig = require('./appconfig');
const devman = require('./devices/devicemanager');

class Holder extends EventEmitter {

  async start() {
    await devman.start();
  }
    // this.devSet = devman.createDevSet();
  
/** 
  getDevObj(dn) {
    return this.devSet[dn];
  }
*/
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