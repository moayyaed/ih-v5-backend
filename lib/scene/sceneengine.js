/**
 * sceneengine.js
 */
const util = require('util');
const appconfig = require('../appconfig');

const Sceno = require('./sceno');
const Scenedevo = require('./scenedevo');
// const sceneutils = require('./sceneutils');

const hut = require('../utils/hut');
const datautil = require('../api/datautil');

const Timerman = require('../utils/timermanager');

// Запустить механизм таймеров для интервальных таймеров сценариев c мин интервалом 100 мс
const tm = new Timerman(0.1);

class Scenengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = this.holder.dm;
    // console.log('SCENEENGINE START typeof this.holder ' + typeof this.holder);
    // console.log('SCENEENGINE START typeof this.holder.devSet ' + typeof this.holder.devSet);

    this.agent = agent;

    this.sceneSet = {}; // Работающие сценарии
    holder.sceneSet = this.sceneSet;

    this.devsceneSet = {}; // 'd0011':Set {'mLight', 32,..] - для отработки событий
    holder.devsceneSet = this.devsceneSet; // Для показа используемых устройствами сценариев 
    this.multiMap = new Map(); // Хранятся мультисценарии (папки) для работы с экземплярами

    tm.on('ready', this.onTimerReady);
  }
  start() {
    this.holder.on('start:scene', (query, callback) => {
      this.onStartScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        this.debugctl(mode, uuid.split('_').pop());
      }
    });

    /*
    holder.on('data', this.onDeviceData);
    holder.on('scene', this.onSceneChange);
    holder.on('schedule', this.onScheduleChange);
    holder.on('stopscene', this.onStopScene);
    holder.on('blockscene', this.onBlockScene);
    holder.on('blocksch', this.onBlockSch);
    */

    this.agent.on('log', this.onLog);
    this.agent.on('doCommand', this.onDoCommand);
    /*
    agent.on('syslog', this.onSyslog);
    agent.on('info', this.onInfo);
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

  /*
  start(sceneDocs) {
    console.log('INFO: Scene engine has started, scenes: ' + sceneDocs.length);
    sceneDocs.forEach(sobj => {
      const id = sobj._id;
      if (!id || sobj.unget) {
        // console.log('ID Undefined: '+util.inspect(sobj))
      } else if (sobj.multi) {
        // Если мультисценарий - будут созданы экземпляры на основе calls
        this.multiMap.set(id, sobj);
      } else {
        const filename = appconfig.getReqScriptFilename(id);
        this.sceneSet[id] = new Sceno(id, filename, this.getActualParams(sobj, id), this.agent);

        if (sobj.devs && sobj.extprops) {
          // Добавить свойства устройствам
          this.addExtPropsFromScene(id, sobj.devs, sobj.extprops);
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
                    console.log('WARN: sceneengine. NOT Found ' + did);
                  }
                }
              });
            });
          }
        }
      });
      // console.log('INFO: SceneEngine FILL devsceneSet, size=' + Object.keys(this.devsceneSet).length);
      // console.log('INFO: SceneEngine holder.devsceneSet, size=' + Object.keys(this.holder.devsceneSet).length);
    }, 2000);

    // Запустить сценарии, которые должны запускаться на старте
    // bootStart();
  }
  */

  addScene(doc, opt) {
    const id = doc._id;
    const filename = appconfig.getReqScriptFilename(id);
    const multi = opt && opt.multi ? 1 : 0;
    if (multi) {
      this.multiMap.set(id, { ...doc, filename });
      return;
    }

    const actualParams = this.getActualParams(doc.devs, doc.def, doc.extprops, id);
    this.sceneSet[id] = new Sceno(id, filename, actualParams, this.agent);
  }

  addMultiCall(doc) {
    const id = doc._id;
    const sceneId = doc.parent;
    const sobj = this.multiMap.get(sceneId);
    const actualParams = this.getActualParams(sobj.devs, doc, sobj.extprops, id)

    this.sceneSet[id] = new Sceno(id, sobj.filename, actualParams, this.agent);
  }

  getMultiScene(scene) {
    return this.multiMap.get(scene);
  }

  addExtPropsForDevice(did, patdev, scene) {
    const sobj = this.getMultiScene(scene);
    if (!sobj || !sobj.extprops || !sobj.extprops[patdev]) return;

    // Добавить свойства устройству
    if (this.holder.devSet[did]) {
      this.holder.devSet[did].addExtProps(sobj.extprops[patdev], scene);
    } else {
      console.log('WARN: sceneengine.addExtPropsForDevice. NOT Found device ' + did + ' for scene ' + scene);
    }
  }

  deleteExtPropsForDevice(did, scene) {
    // Удалить свойства устройства
    if (this.holder.devSet[did]) {
      this.holder.devSet[did].deleteExtProps(scene);
    } else {
      console.log('WARN: sceneengine.deleteExtPropsForDevice. NOT Found device ' + did + ' for scene ' + scene);
    }
  }

  /**
   *
   * @param {String} devs - список устройств - список устройств сценария: 'lamp,sensor'
   *         (то что стоит перед Device: const lamp = Device("LAMP1"))
   *
   * @param {Object} def - соответствие фактическим устройствам: {lamp:'LAMP1', sensor:'DD1'}
   *        Для мультисценария берется из экземпляра
   * @param {*} sceneId
   */
  getActualParams(devs, def, extprops, sceneId) {
    const global = wrapGlobal(this.holder.glSet, sceneId);
    const res = { global };

    if (devs && def) {
      try {
        const arr = devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = def[dev];
          const dobj = this.holder.dnSet[dn];
          if (!dobj) throw({message:'Not found device '+dn});

          if (extprops && extprops[dev]) dobj.addExtProps(extprops[dev], sceneId);

          const did = dobj._id;
          if (!this.devsceneSet[did]) this.devsceneSet[did] = new Set();
          this.devsceneSet[did].add(sceneId); 
          
          res[dev] = new Scenedevo(this.holder.dnSet[dn], sceneId);
        });
      } catch (e) {
        console.log(
          'ERROR: sceneengine id=' + sceneId + ' getActualParams ' + util.inspect(def) + '. ' + util.inspect(e)
        );
      }
    }
    // console.log('getActualParams: sobj ' + util.inspect(sobj) + '. res=' + util.inspect(res));
    return res;
  }

  addExtPropsFromScene(id, devs, extprops) {
    
    const arr = devs.split(',');
   
      arr.forEach(patdev => {
        if (item[patdev]) {
          const did = item[patdev];

          if (!this.devsceneSet[did]) this.devsceneSet[did] = new Set();
          this.devsceneSet[did].add(id); // Здесь нужно id экземпляра, а не сценария!

          // Добавить свойства устройству did
          if (this.holder.devSet[did] && extprops[patdev]) {
            this.holder.devSet[did].addExtProps(extprops[patdev], id);
          } else {
            console.log('WARN: sceneengine.addExtPropsFromScene NOT Found device with _id=' + did);
          }
        }
      });
  }

  // Event handlers
  // Отработка событий holder
  onStartScene(query, callback) {
    let id;
    let arg;
    let sender;
    if (typeof query == 'object') {
      id = query.id;
      arg = query.arg;
      sender = query.sender;
    } else {
      id = query;
    }
    let err = '';
    console.log('WARN: START SCENE ' + JSON.stringify(id));

    if (this.sceneSet[id].isReady()) {
      this.fixStart(id, sender);
      this.sceneSet[id].start(arg, sender); // Запуск функции start из скрипта

      if (!this.sceneSet[id].isPending()) {
        this.fixStop(id);
      }
    } else err = 'Not found script: ' + id;

    if (callback && typeof callback == 'function') {
      callback(err);
    }
  }

  fixStart(name, sender) {
    if (!this.sceneSet[name].isActive()) {
      let ts = Date.now();
      this.sceneSet[name].__started(ts);

      if (sender) this.sceneSet[name].sender = sender;
      this.debug(name, 'Started');

      // workscenesUpdate({ id: name, active: 1, laststart: ts, qstarts: sceneSet[name].__qstarts });
    }
  }

  fixStop(name) {
    // TODO Удалить все алерты этого сценария, слушатели и таймеры удаляются в stopped
    if (this.sceneSet[name].isActive()) {
      this.sceneSet[name].chobj = '';
      let ts = Date.now();
      this.sceneSet[name].__stopped(ts);
      this.sceneSet[name].sender = '';
      tm.deleteAllTimers({ owner: name });

      this.debug(name, 'Stopped');
      // workscenesUpdate({ id: name, active: 0, laststop: ts });
    }
  }

  // Отработка событий agent
  onLog(sceneId, msg) {
    // this.holder.emit('log', msg);
    // this.dm.insertToLog('pluginlog', { unit, txt, level });
    this.debug(sceneId, msg);
  }

  onDoCommand = function(sceneId, dobj, command, value) {
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
    const sender = { scene: sceneId };
    if (!dobj.hasCommand(command)) {
      msg = 'No command "' + command + '" for device: ' + dobj.dn + '  (' + dobj.name + ')';
    } else {
      msg = 'do ' + dobj.dn + ' ' + command + ' ' + (value != undefined ? value : '');
      dobj.doCommand(command, sender);
    }
    this.debug(sceneId, msg);
  };

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
        this.debug(name, 'Done timer ' + timername);

        // Если есть функция, которую надо запустить - запуск
        // tryExec(name, sceneSet[name].getTimerCall(timername));
      }
    }
  }

  // Отработка событий dm - редактирование сценариев
  onInsertScene(doc) {}

  onUpdateScene(doc) {}

  onRemoveScene(doc) {}

  onInsertSceneCall(doc) {
    console.log('WARN: onInsertSceneCall doc=' + util.inspect(doc));
    const scene = doc.sid;
    if (!scene) return;
    const sobj = this.getMultiScene(scene);

    // Добавлен новый набор - проверить все patdev
    const arr = sobj.devs.split(',');
    arr.forEach(patdev => {
      if (sobj.extprops[patdev] && doc[patdev]) {
        this.addExtPropsForDevice(doc[patdev], patdev, scene);
      }
    });
  }

  onUpdateSceneCall(doc) {
    console.log('WARN: onUpdateSceneCall doc=' + util.inspect(doc));
    if (!doc.$set) return;

    const scene = doc.sid;
    if (!scene) return;

    const sobj = this.getMultiScene(scene);
    // Удалить для предыдущего значения, добавить для нового
    Object.keys(doc.$set).forEach(patdev => {
      if (sobj.extprops[patdev]) {
        if (doc[patdev]) this.deleteExtPropsForDevice(doc[patdev], scene);

        this.addExtPropsForDevice(doc.$set[patdev], patdev, scene);
      }
    });
  }

  onRemoveSceneCall(doc) {
    console.log('WARN: onRemoveSceneCall doc=' + util.inspect(doc));
    if (!doc.$unset) return;
  }

  debugctl(mode, id) {
    console.log('EE debugctl ' + id);
    if (!this.sceneSet[id]) return;

    const sobj = this.sceneSet[id];
    sobj.debug = mode; // 0 || 1
    if (mode) {
      // Включена подписка - вывести текущее состояние
      this.debug(id, datautil.getStatusStr(sobj, 'unitStateList'));
    }
  }

  debug(id, msg) {
    if (!this.sceneSet[id] || !this.sceneSet[id].debug) return;

    this.holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
  }
}

function wrapGlobal(glSet, sceneId) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        return glSet.getValue(prop);
      },

      set(target, prop, value) {
        glSet.setValue(prop, value, { src: 'scene ' + sceneId });
        return true;
      }
    }
  );
}

module.exports = Scenengine;
