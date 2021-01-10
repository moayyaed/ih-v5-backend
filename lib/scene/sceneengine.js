/**
 * sceneengine.js
 *  - формирует
 *     - worksceneSet[id экземпляра сценария] = {milti, scene, child, laststart,laststop, active, err}
 *       Общий список рабочих сценариев системы
 *       хранит данные о типе (multi), состоянии и ошибке, где запущен (child)
 *
 *     -  extprops[sceneId][dev][prop] = {name, note, val, type,...}
 *        Расширенные свойства устройств,приходят от сценариев, используются устр-вами
 *     -  dnMainSet[dn] = Set['scene_001', '42',...]
 *        dnChildSet[dn] = Set['scene_001', '42',...]
 *        Карты связи устройств со сценариями отдельно для основного и дочернего
 *           для показа, где участвует устройство
 *           для child - для передачи данных устройств (слепок устройства, on('data'))
 *           mainengine сам слушает on('data')
 *
 *  - запускает два движка для выполнения сценариев - в основном (mainengine) и дочернем процессе (childengine)
 *    - передает движкам команды  addscene, startscene, stopscene, blockscene, removescene
 *    - движку  childengine:
 *        - передает слепок устройств (devcast), участвующих в сценариях
 *          - на старте - слепок всех устройств из dnChildSet
 *          - при изменении сценария (или устройства - структуры, плоских данных, атрибутов) - передать новый слепок
 *
 *        - транслирует все данные об изменении устройств его сценариев по событию data
 *
 *  - движки mainengine и childengine
 *     - формируют triggerSet[dn], listenerSet[dn] - в разрезе свойств
 *       сами запускают сценарии по триггерам,таймерам и слушателям
 *
 */

const util = require('util');
const path = require('path');

const appconfig = require('../appconfig');
const { fork } = require('child_process');

const Worksceno = require('./worksceno');

const Scenedevo = require('./scenedevo');

const Mainengine = require('./mainengine');

// const hut = require('../utils/hut');
const datautil = require('../api/datautil');

class Scenengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = this.holder.dm;
    this.agent = agent;
    agent.start(holder);

    // console.log('SCENEENGINE START typeof this.holder ' + typeof this.holder);
    // console.log('SCENEENGINE START typeof this.holder.devSet ' + typeof this.holder.devSet);

    this.worksceneSet = {}; // Работающие сценарии
    holder.worksceneSet = this.worksceneSet;

    this.extprops = {}; // Расширенные свойства устройств - приходят от сценариев. В устройстве только ссылка на сценарий
    holder.extprops = this.extprops; // Здесь храним описание св-в: [sceneId][dev][prop] = {name, note, val, type,...}

    // this.multiMap = new Map(); // Хранятся мультисценарии (папки) для работы с экземплярами

    this.dnMainSet = {}; // 'd0011':Set {'mLight', 32,..]
    this.mainEngine = new Mainengine(holder, agent);

    this.dnChildSet = {};
    this.childEngine = this.runChild();

    // Для показа используемых устройствами сценариев
    holder.devsceneSet = { main: this.dnMainSet, child: this.dnChildSet };
  }

  runChild() {
    // Запуск дочернего процесса для сценариев с низким приоритетом (которые должны запускаться в дочернем)
    const ps = fork(path.join(__dirname, 'childengine.js'), []);

    if (!ps) {
      console.log('ERROR: child scene engine fork error!');
      return;
    }

    ps.on('close', code => {
      console.log('ERROR: child scene engine exited with ' + code);
    });

    ps.on('message', async m => {
      console.log('INFO: child scene engine message: ' + util.inspect(m));
      switch (m.type) {
        case 'debug':
          return this.agent.debug(m.id, m.text);
        case 'started':
          return this.fixStart(m.id);
        default:
      }
    });
    return ps;
  }

  start() {
    // Передать слепки устройств в дочерний процесс - устройства для всех сценариев, кот запускаются в child
    this.childEngine.send({ type: 'adddevs', payload: this.getDevCasts(Object.keys(this.dnChildSet)) });

    // При изменении данных - передается в дочерний процесс, main обрабатывает сам
    this.holder.on('changed:device:data', data => {
      this.sendChangedDeviceData(data);
    });

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

  getDevCasts(dnArray) {
    const res = [];
    dnArray.forEach(dn => {
      const dobj = this.holder.dnSet[dn];
      if (dobj) {
        res.push(dobj.getDevCast());
      } // else  Устройства нет
    });
    return res;
  }

  addScene(doc) {
    const id = doc._id;
    const filename = appconfig.getReqScriptFilename(id);

    // Если есть расширенные свойства - добавить в this.extprops
    if (doc.extprops) this.addExtprops(doc.extprops, id);

    // if (multi)  - нужны все экземпляры!!

    // Проверить, что файл существует?
    this.worksceneSet[id] = new Worksceno(id, this.agent);

    // Устройства сценария
    this.adDevsToDnSet(doc, id, doc.runInChild);

    if (doc.runInChild) {
      this.worksceneSet[id].child = 1;
      // Передать в дочерний процесс
      this.childEngine.send({ type: 'addscene', id, filename, doc });
    } else {
      const actualParams = this.getActualParams(doc.devs, doc.def, doc.extprops, id);
      this.mainEngine.addScene(id, filename, doc, actualParams);
    }
  }

  adDevsToDnSet(doc, sceneId, child) {
    if (doc.devs && doc.def && sceneId) {
      const devs = doc.devs;
      const def = doc.def;
      try {
        const arr = devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = def[dev]; // Это м б объект!!
          adOneDnToDnSet(child ? this.dnChildSet : this.dnMainSet, dn, sceneId);
        });
      } catch (e) {
        console.log('ERROR: adDevsToDnSet ' + util.inspect(doc) + ': ' + util.inspect(e));
      }
    }
  }

  /**
   *
   * @param {Object} sceneExtProps {lamp:[{name:'timeoff', note:'Время...'}]}
   * @param {String} sceneId
   */
  addExtprops(sceneExtProps, sceneId) {
    if (typeof sceneExtProps != 'object') return;

    if (!this.extprops[sceneId]) this.extprops[sceneId] = {};
    Object.keys(sceneExtProps).forEach(dev => {
      this.extprops[sceneId][dev] = sceneExtProps[dev];
    });
  }

  /*
  addMultiCall(doc) {
    const id = doc._id;
    const sceneId = doc.parent;
    const sobj = this.multiMap.get(sceneId);
    const actualParams = this.getActualParams(sobj.devs, doc, sobj.extprops, id);

    this.sceneSet[id] = new Sceno(id, sobj.filename, actualParams, this.agent);
  }

  getMultiScene(scene) {
    return this.multiMap.get(scene);
  }
  */

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

    try {
      const arr = devs.split(',').filter(el => el);
      arr.forEach(dev => {
        const dn = def[dev]; // Это м б объект!!
        const dobj = this.holder.dnSet[dn];
        if (!dobj) throw { message: 'Not found device ' + util.inspect(dn) };

        res[dev] = new Scenedevo(dobj, sceneId, this.agent);
      });
    } catch (e) {
      console.log(
        'ERROR: sceneengine id=' + sceneId + ' getActualParams ' + util.inspect(def) + '. ' + util.inspect(e)
      );
    }

    // console.log('getActualParams: sobj ' + util.inspect(sobj) + '. res=' + util.inspect(res));
    return res;
  }

  sendChangedDeviceData(data) {
    const payload = [];
    data.forEach(item => {
      // item { did: 'd0024', dn: 'vvv150', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3}
      if (this.dnChildSet[item.dn]) {
        payload.push(item);
      }
    });
    if (payload.length) this.childEngine.send({ type: 'devicedata', payload });
  }

  onStartScene(query, callback) {
    let id;

    if (typeof query == 'object') {
      id = query.id;
    } else {
      id = query;
    }
    let err = '';
    console.log('WARN: START SCENE ' + JSON.stringify(id));
    // Это интерактивный запуск
    // Проверено, что сценарий может быть запущен - ??
    if (this.worksceneSet[id].child) {
      this.fixStart(id);
      this.childEngine.send({ type: 'startscene', id });
    } else {
      this.mainEngine.startScene(id);
    }
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
    if (this.worksceneSet[id]) {
      this.worksceneSet[id].exit();
      this.fixStop(id);
    }
  }

  fixStart(name, sender) {
    // if (!this.worksceneSet[name].isActive()) {
    if (this.worksceneSet[name]) {
      let ts = Date.now();
      this.worksceneSet[name].__started(ts);

      if (sender) this.worksceneSet[name].sender = sender;
    }
  }

  fixStop(name) {
    if (this.worksceneSet[name].isActive()) {
      this.worksceneSet[name].chobj = '';
      let ts = Date.now();
      this.worksceneSet[name].__stopped(ts);
      this.worksceneSet[name].sender = '';
      this.agent.debug(name, 'Stopped');
    }
  }

  onUpdateScene(doc) {}

  onRemoveScene(doc) {}

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
    if (!this.worksceneSet[id]) return;

    const sobj = this.worksceneSet[id];
    sobj.debug = mode; // 0 || 1
    if (mode) {
      // Включена подписка - вывести текущее состояние
      console.log('EE debugctl sobj=' + datautil.getStatusStr(sobj, 'unitStateList'));
      this.agent.debug(id, datautil.getStatusStr(sobj, 'unitStateList'));
    }
  }
}

// Частные функции
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

function adOneDnToDnSet(dnSet, dn, sceneId) {
  if (!dnSet[dn]) dnSet[dn] = new Set();
  dnSet[dn].add(sceneId);
}

module.exports = Scenengine;

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
