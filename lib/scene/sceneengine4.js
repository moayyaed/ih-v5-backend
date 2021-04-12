/**
 * sceneengine4.js
 */

const util = require('util');

const appconfig = require('../appconfig');
// const hut = require('../utils/hut');

const Worksceno = require('./worksceno');
const Mainengine = require('./mainengine');

const datautil = require('../api/datautil');

class Scenengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = holder.dm;
    this.agent = agent;
    agent.start(holder);

    this.worksceneSet = {}; // Работающие сценарии
    holder.worksceneSet = this.worksceneSet;

    this.extprops = {}; // Расширенные свойства устройств - приходят от сценариев. В устройстве только ссылка на сценарий
    holder.extprops = this.extprops; // Здесь храним описание св-в: [sceneId][dev][prop] = {name, note, val, type,...}

    // Для показа используемых устройствами сценариев
    this.dnMainSet = {}; // 'd0011':Set {'mLight', 32,..]
    this.dnChildSet = {};
    holder.devsceneSet = { main: this.dnMainSet, child: this.dnChildSet };

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

  /** addScene
   *
   * Добавление сценария на базе документа
   *  - добавляет расширенные свойства устройств в extprops
   *  - добавляет устройства сценария в devsceneSet
   *  - добавляет объект(ы) worksceneSet
   *  - добавляет экземпляр(ы) сценария (mainengine, childengine)
   *
   * @param {Object} doc - документ из таблицы сценариев
   * @param {Array of Object} calls - опционально для мультисценария - массив параметров экземпляров
   *
   */
  addScene(doc, calls) {
    const sceneId = doc._id;

    if (doc.extprops) this.addExtprops(doc.extprops, sceneId);

    const blk = doc.blk || doc.err ? 1 : 0;
    const error = doc.err ? doc.errstr : '';
    console.log('addScene ' + sceneId + ' blk=' + blk);
    const filename = appconfig.getReqScriptFilename(sceneId);
    if (!doc.multi) {
      this.adDevsToDnSet(doc, sceneId, doc.runInChild); // Устройства сценария
      this.upsertWorksceneItem(sceneId, { multi: 0, blk, error, sceneId });

      if (!blk) this.mainEngine.addSceneInstance(sceneId, doc, filename, doc.def);
      return;
    }

    // if (multi)  - нужны все экземпляры!! + создать worksceneSet item c индикатором multi
    this.upsertWorksceneItem(sceneId, { multi: 1, blk, error, sceneId }); // Для этого элемена экземпляр не нужен
    if (!calls || !calls.length) return; // Пока нет экз
    // calls.forEach(call => this.addSceneInstance(id, doc, filename, call));
  }

  /** upsertWorksceneItem
   * Добавление объекта worksceneSet
   *  - если объект уже существует - он будет перезаписан
   *
   * @param {String} id - id экземпляра
   * @param {Object} - свойства экземпляра
   */
  upsertWorksceneItem(id, { multi, blk, error, sceneId, child = 0 }) {
    const debug = this.worksceneSet[id] && this.worksceneSet[id].debug ? 1 : 0;
    this.worksceneSet[id] = new Worksceno({ id, sceneId, child, debug, blk, multi, error }, this.agent);
  }

  /** adDevsToDnSet
   * Добавление устройств в devsceneSet (dnMainSet или dnChildSet) на основании документа сценария
   *
   * @param {Object} doc
   * @param {String} sceneId - id сценария
   * @param {Bool} child
   */
  adDevsToDnSet(doc, sceneId, child) {
    if (doc.devs && doc.def && sceneId) {
      const devs = doc.devs;
      const def = doc.def;
      try {
        const arr = devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = def[dev]; // TODO Это м б объект!! Для multi - ??
          adOneDnToDnSet(child ? this.dnChildSet : this.dnMainSet, dn, sceneId);
        });
      } catch (e) {
        console.log('ERROR: adDevsToDnSet ' + util.inspect(doc) + ': ' + util.inspect(e));
      }
    }
  }

  /** addExtprops
   * Добавление расширенных свойств, вводимых сценарием для устройств, в extprops
   *
   * @param {Object} sceneExtProps {lamp:[{name:'timeoff', note:'Время...'}]}
   * @param {String} sceneId - id сценария
   */
  addExtprops(sceneExtProps, sceneId) {
    if (typeof sceneExtProps != 'object') return;

    if (!this.extprops[sceneId]) this.extprops[sceneId] = {};
    Object.keys(sceneExtProps).forEach(dev => {
      this.extprops[sceneId][dev] = sceneExtProps[dev];
    });
  }

  // TODO - Добавление расширенных свойств устройствам
  /*
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
  */

  async updateScene(doc) {
    // остановить, удалить и заново добавить - это нужно делать в engines?
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
  }

  debugShowStatus(id) {
    if (this.worksceneSet[id] && this.worksceneSet[id].debug) {
      this.agent.debug(id, datautil.getStatusStr(this.worksceneSet[id], 'sceneStateList'));
    }
  }

  // Интерактивный запуск/останов
  // TODO Проверено, что сценарий может быть запущен - ??
  startScene(query, callback) {
    const id = typeof query == 'object' ? query.id : query;
    console.log('WARN: START SCENE ' + JSON.stringify(id));
    this.mainEngine.startScene(id, callback);
  }

  stopScene(query, callback) {
    const id = typeof query == 'object' ? query.id : query;
    this.mainEngine.stopScene(id, callback);
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
