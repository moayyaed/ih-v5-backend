/**
 * mainengine.js
 *
 */
const util = require('util');


// const appconfig = require('../appconfig');


const { Sceno } = require('./sceno');
const Scenedevo = require('./scenedevo');
// const sceneutils = require('./sceneutils');

// const hut = require('../utils/hut');
const datautil = require('../api/datautil');

// const Timerman = require('../utils/timermanager');

class Mainengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = this.holder.dm;
    this.agent = agent;

    this.sceneSet = {}; 

    this.multiMap = new Map(); // Хранятся мультисценарии (папки) для работы с экземплярами
  }


  start() {
    this.holder.on('start:scene', (query, callback) => {
      this.onStartScene(query, callback);
    });

    this.holder.on('stop:scene', (query, callback) => {
      this.onStopScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        this.debugctl(mode, uuid.split('_').pop());
      }
    });

  }


  addScene(id, filename, actualParams) {
    this.sceneSet[id] = new Sceno(id, this.agent, filename, actualParams);
  }

  removeScene(id) {
    delete this.sceneSet[id];
  }
  

  addMultiCall(doc) {
    const id = doc._id;
    const sceneId = doc.parent;
    const sobj = this.multiMap.get(sceneId);
    const actualParams = this.getActualParams(sobj.devs, doc, sobj.extprops, id);

    this.sceneSet[id] = new Sceno(id, this.agent, sobj.filename, actualParams);
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
   * @param {Array of Objects} extprops - массив расширенных свойств
   * @param {String} sceneId
   */
  getActualParams(devs, def, extprops, sceneId) {
    const global = wrapGlobal(this.holder.glSet, sceneId);
    const res = { global };

    if (devs && def) {
      try {
        const arr = devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = def[dev]; // Это м б объект!!
          const dobj = this.holder.dnSet[dn];
          if (!dobj) throw { message: 'Not found device ' + util.inspect(dn) };

          if (extprops && extprops[dev]) dobj.addExtProps(extprops[dev], sceneId);

          const did = dobj._id;
          if (!this.devsceneSet[did]) this.devsceneSet[did] = new Set();
          this.devsceneSet[did].add(sceneId);

          res[dev] = new Scenedevo(this.holder.dnSet[dn], sceneId, this.agent);
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
    // НЕ ИСП!!

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

  startScene(id, callback) {
   

    if (this.sceneSet[id].isReady()) {
      this.fixStart(id);
      
      this.sceneSet[id].start(); // Запуск функции start из скрипта

      if (!this.sceneSet[id].isPending()) {
        this.fixStop(id);
      }
    } 
    /*
    if (callback && typeof callback == 'function') {
      callback(err);
    }
    */
  }

  /**  ON stopscene - интерактивный стоп сценария
   */
  onStopScene(query, callback) {
    let id;

    if (typeof query == 'object') {
      id = query.id;
    } else {
      id = query;
    }
    if (this.sceneSet[id]) {
      this.sceneSet[id].exit();
      this.fixStop(id);
    }
  }

  fixStart(name, sender) {
    if (!this.sceneSet[name].isActive()) {
      let ts = Date.now();
      this.sceneSet[name].__started(ts);
      if (sender) this.sceneSet[name].sender = sender;
    }
  }

  fixStop(name) {
    // TODO Удалить все алерты этого сценария, слушатели и таймеры удаляются в stopped
    if (this.sceneSet[name].isActive()) {
      this.sceneSet[name].chobj = '';
      let ts = Date.now();
      this.sceneSet[name].__stopped(ts);
      this.sceneSet[name].sender = '';
      this.agent.debug(name, 'Stopped');
    }
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
        timeobj.sts >= this.sceneSet[name].laststart
      ) {
        this.sceneSet[name].setTimerState(timername, 2, timeobj);
        this.debug(name, 'Done timer ' + timername);

        // Если есть функция, которую надо запустить - запуск
        // tryExec(name, sceneSet[name].getTimerCall(timername));
      }
    }
  }

  onUpdateScene(doc) {}

  

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

module.exports = Mainengine;
