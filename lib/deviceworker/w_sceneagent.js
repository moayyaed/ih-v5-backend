/**
 * w_sceneagent.js
 *
 * Agent for sceno instances
 *  - emits via wCore
 *  - works with scene timers
 *  - debug
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


  
  startTimer(id, tname, interval, callback) {
    this.tm.setTimer({ owner:id, tname, interval }, callback);
    this.debug(id, 'Start timer '+tname+' for '+interval +' sec');
  },

  restartTimer(id, tname, interval, callback) {
    this.tm.setTimer({ owner:id, tname, interval, restart: true }, callback);
    this.debug(id, 'Start/restart timer '+tname+' for '+interval +' sec');
  },

  stopTimer(id, tname) {
    this.tm.clearTimer(id, tname);
  },

  /*
  startTimer (sceneId, timername, interval) {
    // Интервальный таймер
    if (interval < 200000) {
      debugMsg(sceneId, 'start timer ' + timername + ' for ' + interval + ' sek');
      return tm.startTimer(interval, { owner: sceneId, tname: timername });
    }

    // Таймер на точку времени (ts)
    const txt = hut.getDateTimeFor(new Date(interval), 'shortdtms') + ' (' + interval + ')';
    debugMsg(sceneId, 'start timer ' + timername + ' on time = ' + txt);
    return sctm.addTimer({ qts: interval, owner: sceneId, tname: timername });
  },

  stopTimer (sceneId, timername, interval) {
    debugMsg(sceneId, 'stop timer ' + timername);

    if (interval < Date.now()) {
      // Интервальный таймер
      tm.deleteTimer(interval, { owner: sceneId, tname: timername });
    } else {
      sctm.deleteTimer({ owner: sceneId, tname: timername });
    }
  },
  */

  // Отработка событий таймеров 
  /**
   *
   * @param {*} timeobj  { owner, tname, callback, sts, qts }
   */
  onTimerReady(timeobj) {
    if (timeobj && timeobj.owner && timeobj.tname) {
      const { owner, tname, callback } = timeobj;
      this.debug(owner, 'Timer '+tname+' done .');
      if (callback) {
        // callback(this.holder.devSet[owner]);
        
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
