/**
 * agent.js
 *
 * Agent for sceno instances
 *  - emits via holder
 *  - works with scene timers
 */

const util = require('util');

const hut = require('../utils/hut');
const Extimerman = require('../utils/extimermanager');


module.exports = {
  start(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  log(id, msg) {
    this.debug(id, msg);
  },

  debug(id, msg) {
    const sobj = this.holder.worksceneSet[id];
    if (!sobj || !sobj.debug) return;

    this.holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
  },

  // Отработка событий таймеров (таймеры взводят  сценарии)
  /**
   * 
   * @param {*} timeobj  { owner, tname, callback, sts, qts } 
   */
  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      const { owner, tname, callback } = timeobj;

      if (callback) {
        callback(this.holder.devSet[owner]);
      }
     
    }
  },

  doCommand (id, dobj, command, value) {
    // Если запускается команда aon (aoff) - установить флаг и изменить команду
    /*
    if (command == 'aon') {
      command = dobj.runA = 'on';
    }
    if (command == 'aoff') {
      command = dobj.runA = 'off';
    }
    */
    let msg = '';
    const sender = { scene: id };
    if (!dobj.hasCommand(command)) {
      msg = 'No command "' + command + '" for device: ' + dobj.dn + '  (' + dobj.name + ')';
    } else {
      msg = 'do ' + dobj.dn + ' ' + command + ' ' + (value != undefined ? value : '');
      dobj.doCommand(command, sender);
    }
    this.debug(id, msg);
  }


}