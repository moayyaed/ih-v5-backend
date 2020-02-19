/**
 * unito.js
 */

const hut = require('../utils/hut');

class Unito {
  constructor(uref) {
    if (!uref.plugin) throw { message: 'Undefined property plugin for unit ' + uref.id };

    hut.clone(uref, this);
    this.initOk = 0;
    this.formTimeProps(uref.timeout, uref.restarttime);
    // this.formPropsDueToManifest(houser);
    if (!uref.addon) this.mapRebuild = 1; 
  }
}

module.exports = Unito;