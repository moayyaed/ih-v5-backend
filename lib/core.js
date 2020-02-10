/**
 * 
 */

// const util = require('util');
const EventEmitter = require('events');

// const appconfig = require('./appconfig');
const devutils = require('./devices/devutils');

module.exports = class Core extends EventEmitter {
  constructor() {
    super();
    this.devSet = devutils.createDevSet();
  }

  getDevObj(dn) {
    return this.devSet[dn];
  }
 
 

}

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