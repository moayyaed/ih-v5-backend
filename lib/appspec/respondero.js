/**
 * vsresponder.js
 * Объект для формирования сообщений изнутри visscript
 * 
 */

const util = require('util');

// const hut = require('../utils/hut');
const servercommands = require('./servercommands');

class Respondero {
  constructor(clid, holder) {
    this.holder = holder;
    this.clid = clid;
  }

  
  gotoLayout(layoutId, frameObj) {
    const resObj = servercommands.gotoLayout(layoutId, frameObj);
    if (!resObj || typeof resObj == 'string') {
      console.log('ERROR: gotoLayout for '+layoutId+', '+util.inspect(frameObj)+' error: '+resObj)
      return;
    }
    this.holder.emit('wssend', this.clid, resObj); 
  }
}

module.exports = Respondero;