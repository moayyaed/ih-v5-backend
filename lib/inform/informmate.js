/**
 * informmate.js
 */

const util = require('util');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

class Informmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  start() {
    // При добавлении, изменении, удалении адресов
    this.dm.on('inserted:infoaddr', docs => {});
  }
}
module.exports = Informmate;
