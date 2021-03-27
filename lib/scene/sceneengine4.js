/**
 * sceneengine4.js
 */

const util = require('util');
// const path = require('path');
// const { fork } = require('child_process');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const Worksceno = require('./worksceno');
const Scenedevo = require('./scenedevo');
const Mainengine = require('./mainengine');

const datautil = require('../api/datautil');

class Scenengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = this.holder.dm;
    this.agent = agent;
    agent.start(holder);

    this.worksceneSet = {}; // Работающие сценарии
    holder.worksceneSet = this.worksceneSet;

    this.extprops = {}; // Расширенные свойства устройств - приходят от сценариев. В устройстве только ссылка на сценарий
    holder.extprops = this.extprops; // Здесь храним описание св-в: [sceneId][dev][prop] = {name, note, val, type,...}

    // Для показа используемых устройствами сценариев
    this.dnMainSet = {}; // 'd0011':Set {'mLight', 32,..]
    this.dnChildSet = {};
    holder.devsceneSet = { main: this.dnMainSet };

    this.mainEngine = new Mainengine(holder, agent);
  }

  start() {
    this.holder.on('start:scene', (query, callback) => {
      this.startScene(query, callback);
    });

    this.holder.on('stop:scene', (query, callback) => {
      this.stopScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        this.debugctl(mode, uuid.split('_').pop());
      }
    });
  }

  addScene(doc, calls) {
    const sceneId = doc._id;
    if (doc.extprops) this.addExtprops(doc.extprops, sceneId);
    const blk = doc.blk || doc.err ? 1 : 0;
    const error = doc.err ? doc.errstr : '';

    const filename = appconfig.getReqScriptFilename(sceneId);
    if (!doc.multi) {
      this.adDevsToDnSet(doc, sceneId, doc.runInChild); // Устройства сценария
      this.upsertWorksceneItem(sceneId, { multi: 0, blk, error, sceneId });
      if (!blk) this.addSceneInstance(sceneId, doc, filename, doc.def);
      return;
    }

    // if (multi)  - нужны все экземпляры!! + создать worksceneSet item c индикатором multi
    this.upsertWorksceneItem(sceneId, { multi: 1, blk, error, sceneId }); // Для этого элемена экземпляр не нужен
    if (!calls || !calls.length) return; // Пока нет экз
    // calls.forEach(call => this.addSceneInstance(id, doc, filename, call));
  }

  upsertWorksceneItem(id, { multi, blk, error, sceneId }) {
    const debug = this.worksceneSet[id] && this.worksceneSet[id].debug ? 1 : 0;
    this.worksceneSet[id] = new Worksceno({ id, sceneId, debug, blk, multi, error }, this.agent);
  }

  addSceneInstance(id, doc, filename, def) {
    if (!doc.runInChild) {
      try {
        const actualParams = this.getActualParams(doc.devs, def, doc.extprops, id);
        this.mainEngine.addScene(id, filename, actualParams);
      } catch (e) {
        // Ошибка при запуске - блокировать сценарий
        this.worksceneSet[id].blk = 1;
        this.worksceneSet[id].error = hut.getShortErrStr(e);
      }
      return;
    }

    console.log('WARN: Scene ' + id + ' No childEngine yet!');
    // this.worksceneSet[id].child = 1;
    // Передать в дочерний процесс
    // this.childEngine.send({ type: 'addscene', id, filename, doc });
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
   *
   * @return {Object} - фактические параметры для передачи в сценарий (обертка над каждым устройством)
   * @throw - если не найдены фактические параметры
   */
  getActualParams(devs, def, extprops, sceneId) {
    const global = wrapGlobal(this.holder.glSet, sceneId);
    const res = { global };

    const arr = devs ? devs.split(',').filter(el => el) : [];
    arr.forEach(dev => {
      const dn = def[dev]; // Это м б объект!!
      const dobj = this.holder.dnSet[dn];
      if (!dobj) throw { message: 'Not found device ' + util.inspect(dn) };

      res[dev] = new Scenedevo(dobj, sceneId, this.agent);
    });

    return res;
  }

  // Это интерактивный запуск
  // Проверено, что сценарий может быть запущен - ??
  startScene(query, callback) {
    const id = typeof query == 'object' ? query.id : query;
    console.log('WARN: START SCENE ' + JSON.stringify(id));
    this.mainEngine.startScene(id, callback);
  }

  /**  ON stopscene - интерактивный стоп сценария
   */
  stopScene(query, callback) {
    const id = typeof query == 'object' ? query.id : query;
    this.mainEngine.stopScene(id, callback);
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

  async updateScene(doc) {
    // остановить, удалить и заново добавить - это нужно делать в в engines?
    // doc:{ _id: 'scen003',}
    console.log('updateScene ' + util.inspect(doc));
    this.addScene(doc);
    this.debugShowStatus(doc._id);
  }

  async removeScene(doc) {
    const sceneId = doc._id;
    if (!this.worksceneSet[sceneId]) return;
    this.stopScene(sceneId);

    // Удалить из workscene  в последнюю очередь
    // Сначала удалить из engines??
    // TODO Для multi нужно удалить ВСЕ экземпляры

    if (this.worksceneSet[sceneId].child) {
      removeSceneFromDnSet(this.dnChildSet, sceneId);
      this.childEngine.send({ type: 'removescene', sceneId });
    } else {
      removeSceneFromDnSet(this.dnMainSet, sceneId);
      this.mainEngine.removeScene(sceneId);
    }
    delete this.worksceneSet[sceneId];
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
    if (!this.worksceneSet[id]) return;

    this.worksceneSet[id].debug = mode; // 0 || 1
    this.debugShowStatus(id);
    /*
    if (mode) {
      // Включена подписка - вывести текущее состояние

      this.agent.debug(id, datautil.getStatusStr(sobj, 'sceneStateList'));
    }
    */
  }

  debugShowStatus(id) {
    if (this.worksceneSet[id] && this.worksceneSet[id].debug) {
      this.agent.debug(id, datautil.getStatusStr(this.worksceneSet[id], 'sceneStateList'));
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

// Включить сценарий устройства dn в dnSet (хранить ссылки dn = [sceneid, ...])
function adOneDnToDnSet(dnSet, dn, sceneId) {
  if (!dnSet[dn]) dnSet[dn] = new Set();
  dnSet[dn].add(sceneId);
}

// При удалении сценария - удалить сценарий из всех ссылок dnSet
function removeSceneFromDnSet(dnSet, sceneId) {
  Object.keys(dnSet).forEach(dn => {
    if (dnSet[dn].has(sceneId)) dnSet[dn].delete(sceneId);
  });
}

// При удалении устройства ??? - удалить dnSet[dn]
function removeOneDnFromDnSet(dnSet, dn) {
  if (dnSet[dn]) delete dnSet[dn];
}

module.exports = Scenengine;
