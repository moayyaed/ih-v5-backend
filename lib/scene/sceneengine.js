/**
 * sceneengine.js
 */
const util = require('util');
const appconfig = require('../appconfig');

// const hut = require('../utils/hut');
const Timerman = require('../utils/timermanager');

const Sceno = require('./sceno');
const sceneutils = require('./sceneutils');

class Scenengine {
  constructor(holder, agent) {
    this.holder = holder;
    // console.log('SCENEENGINE START typeof this.holder ' + typeof this.holder);
    // console.log('SCENEENGINE START typeof this.holder.devSet ' + typeof this.holder.devSet);

    this.agent = agent;

    this.sceneSet = {};
    this.devsceneSet = {}; // 'LAMP1':Set {'mLight', 32,..] - name простого сценария, id экземпляра мульти
    this.multiMap = new Map();

    this.holder.multiMap = this.multiMap;
    this.holder.devsceneSet = this.devsceneSet;

    // Запустить механизм таймеров для интервальных таймеров сценариев c мин интервалом 100 мс
    const tm = new Timerman(0.1);
    tm.on('ready', this.onTimerReady);

    holder.on('startscene', query => {
      this.onStartScene(query);
    });
    /*
    holder.on('data', this.onDeviceData);
    holder.on('scene', this.onSceneChange);
    holder.on('schedule', this.onScheduleChange);
    holder.on('stopscene', this.onStopScene);
    holder.on('blockscene', this.onBlockScene);
    holder.on('blocksch', this.onBlockSch);
    holder.on('debugctrl', this.onDebugCtrl);
    */

    agent.on('log', this.onLog);
    /*
    agent.on('syslog', this.onSyslog);
    agent.on('info', this.onInfo);
    agent.on('doCommand', this.onDoCommand);
    agent.on('doAll', this.onDoAll);
    agent.on('assign', this.onAssign);
    agent.on('startTimer', this.onStartTimer);
    agent.on('stopTimer', this.onStopTimer);
    agent.on('pluginCommand', this.onPluginCommand);
    agent.on('dbread', this.onDbread);
    agent.on('dbwrite', this.onDbwrite);
    agent.on('snap', this.onSnap);
    agent.on('isChanged', this.onIsChanged);
    agent.on('exit', this.onExit);
    // getSysTime ??
    agent.on('execOS', this.execOS);
    */
  }

  /**
   * Формирование  sceneSet из sceneDocs
   * @param {Array of objects} sceneDocs - scene doc + call:[{}, {}] - для мультисценариев
   */
  start(sceneDocs) {
    sceneDocs.forEach(sobj => {
      const id = sobj._id;
      if (!id || sobj.unget) {
        // console.log('ID Undefined: '+util.inspect(sobj))
      } else {
        // Если мультисценарий - будут созданы экземпляры на основе calls
        if (sobj.multi) {
          this.multiMap.set(id, sobj);
        } else {
          const filename = appconfig.getReqScriptFilename(id);
          this.sceneSet[id] = new Sceno(id, filename, this.getActualParams(sobj), this.agent);
        }
      }
    });

    // Добавить свойства устройствам
    setTimeout(() => {
      this.multiMap.forEach((sobj, id) => {
        if (sobj.devs) {
          // console.log('CALLS='+util.inspect(sobj.calls));
          // console.log('EXT='+util.inspect(sobj.extprops));
          // console.log('sobj='+util.inspect(sobj));
          if (sobj.calls && Array.isArray(sobj.calls)) {
            const arr = sobj.devs.split(',');
            sobj.calls.forEach(item => {
              arr.forEach(patdev => {
                if (item[patdev]) {
                  
                  const did = item[patdev];

                  if (!this.devsceneSet[did]) this.devsceneSet[did] = new Set();
                  this.devsceneSet[did].add(id); // Здесь нужно id экземпляра, а не сценария!

                  // Добавить свойства устройству
                  if (this.holder.devSet[did] && sobj.extprops[patdev]) {
                    this.holder.devSet[did].addExtProps(sobj.extprops[patdev], sobj._id);
                  } else {
                    console.log('NOT Found ' + did);
                  }
                }
              });
            });
          }
        }
      });
    }, 2000);

    // Запустить сценарии, которые должны запускаться на старте
    // bootStart();
  }

  getActualParams(sobj) {
    let res = { global: this.holder.globals };
    if (sobj.devs && sobj.def) {
      try {
        const arr = sobj.devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = sobj.def[dev];
          // console.log('DN= '+dn+' typeof this.holder.devSet '+typeof this.holder.devSet);
          res[dev] = this.holder.devSet[dn];
        });
      } catch (e) {
        console.log('getActualParams ' + util.inspect(sobj) + ' ERROR:' + util.inspect(e));
      }
    }
    return res;
  }

  // Event handlers
  // Отработка событий holder
  onStartScene(query) {
    console.log('START SCENE ' + JSON.stringify(query));
    this.debugMsg(query.id, 'Start scene ' + query.id);
  }

  // Отработка событий agent
  onLog(sceneId, msg) {
    this.holder.emit('log', msg);
    this.debugMsg(sceneId, msg);
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

  // Отработка событий dm - редактирование сценариев
  onInsertScene(doc) {}

  onUpdateScene(doc) {}

  onRemoveScene(doc) {}

  debugMsg(sceneId, msg) {
    // if (this.sceneSet[sceneId]) {
    console.log('DEBUGMSG: ' + msg);
    // }
  }
}

module.exports = Scenengine;
