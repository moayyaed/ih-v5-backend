/**
 * sceneengine.js
 */

const Timerman = require('../utils/timermanager');

class Scenengine {
  constructor(holder) {
    this.holder = holder;

    this.sceneSet = new Map();

    // Запустить механизм таймеров для интервальных таймеров сценариев c мин интервалом 100 мс
    const tm = new Timerman(0.1);
    tm.on('ready', this.onTimerReady);
    /*
    holder.on('data', this.onDeviceData);
    holder.on('scene', this.onSceneChange);
    holder.on('schedule', this.onScheduleChange);
    holder.on('startscene', this.onStartScene);
    holder.on('stopscene', this.onStopScene);
    holder.on('blockscene', this.onBlockScene);
    holder.on('blocksch', this.onBlockSch);
    holder.on('debugctrl', this.onDebugCtrl);
    */
  }

  start(sceneSet) {
    this.sceneSet.clear();

    // Запустить сценарии, которые должны запускаться на старте
    // bootStart();
  }

  // Отработка событий таймеров сценариев
  onTimerReady(timeobj) {
    // Записать в объект timers сценария, если сценарий активный и таймер все еще активный
    if (timeobj && timeobj.owner && timeobj.tname) {
      let name = timeobj.owner;
      let timername = timeobj.tname;

      if (
        this.sceneSet[name] &&
        this.sceneSet[name].isActive() &&
        this.sceneSet[name].getTimerState(timername) == 1 &&
        timeobj.sts >= this.sceneSet[name].__laststart
      ) {
        this.sceneSet[name].setTimerState(timername, 2, timeobj);
        this.debugMsg(name, 'Done timer ' + timername);

        // Если есть функция, которую надо запустить - запуск
        // tryExec(name, sceneSet[name].getTimerCall(timername));
      }
    }
  }

  debugMsg(name, msg) {
    if (this.sceneSet[name]) {
      console.log(msg);
    }
  }
}

module.exports = Scenengine;
