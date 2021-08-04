/**
 * w_sceneagent.js
 *
 * Agent for sceno instances
 *  - emits via wCore
 *  - works with scene timers
 */

const util = require('util');

const hut = require('../utils/hut');
const Extimerman = require('../utils/extimermanager');

module.exports = {
  start(wCore) {
    this.wCore = wCore;

    this.tm = new Extimerman(0.1);
    this.tm.on('ready', this.onTimerReady.bind(this));
  },

  /*
  setWorksceneStatus(id, obj) {
    if (obj && this.wCore.worksceneSet[id]) {
      Object.assign(this.holder.worksceneSet[id], obj)
    }
  },
  */

  log(id, msg) {
    this.debug(id, msg);
  },

  debug(id, msg) {
    if (this.wCore.sceneSet[id].debug) {
      const message = hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg;
      this.wCore.postMessage('debug:scene', { id, message });
    }
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

  doCommand(id, dobj, command, value) {
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
};
