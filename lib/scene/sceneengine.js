/**
 * sceneengine.js
 * Сценарии запускает worker
 * Движок нужен для
 *  - поддержки редактирования сценариев
 *  - отслеживания состояния
 *  - интерактивного запуска-блокировки
 *  -  для показа используемых устройствами сценариев
 *
 * holder.sceneSet[id] содержит анемичные объекты, описывающие сценарии (экземпляры) и их состояние
 *   Объекты сценариев здесь не создаются
 * Первоначальная загрузка сценариев на старте уже выполнена модулем loadscene??
 *
 * holder.devsceneSet[dn] = Set['scene_001', '42',...] для показа, где участвует устройство
 *
 *
 */

const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const datautil = require('../api/datautil');

const sceneutils = require('./sceneutils');
const Traco = require('../device/traco');

class Scenengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    this.sceneSet = {};
    holder.sceneSet = this.sceneSet;

    // Для показа используемых устройствами сценариев
    this.devsceneSet = {}; // 'd0011':Set {'mLight', 32,.
    holder.devsceneSet = this.devsceneSet;
  }

  start() {
    // holder.sceneSet уже заполнен
    Object.keys(this.holder.sceneSet).forEach(sceneId => {
      this.addDevsToDevsceneSet(this.holder.sceneSet[sceneId], sceneId);
    });

    this.holder.on('start:scene', query => {
      // Интерактивный вызов сценария перенаправить в worker
      // TODO - проверить что сценарий не заблокирован? права?
      console.log('ON start:scene query=' + query); // query=scen002
      this.holder.deviceWorker.postMessage({ name: 'start:scene', data: { id: query } });
      // this.holder.deviceWorker.postMessage({ name: 'start:scene', data: { id: mes.id, arg, sender: 'login:admin' } });
    });

    this.holder.on('stop:scene', (query, callback) => {
      // this.stopScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        this.holder.deviceWorker.postMessage({ name: 'debugctl:scene', data: { mode, uuid } });
        // this.debugctl(mode, uuid.split('_').pop());
      }
    });

    this.holder.on('debug:scene', data => {
      console.log('ON debug:scene data=' + util.inspect(data));
      const { id, message } = data;
      this.holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + message);
    });
  }

  /**
   * Сценарий добавлен динамически
   *  - добавляет объект в sceneSet
   *  - передает сообщение на worker
   * @param {} doc
   */
  addScene(doc) {
    const sceneId = doc._id;
    this.addSceneItem(doc);
    this.holder.deviceWorker.postMessage({ name: 'add:scene', data: { sceneId, doc } });
  }

  async updateScene(doc) {
    // удалить и заново добавить
    // doc:{ _id: 'scen003',}
    const sceneId = doc._id;
    // console.log('updateScene ' + util.inspect(doc));
    this.this.removeSceneItem(sceneId);
    this.addSceneItem(doc);
    this.holder.deviceWorker.postMessage({ name: 'update:scene', data: { sceneId, doc } });
  }

  addSceneItem(doc) {
    const oneScene = sceneutils.createSceneStruct(doc);
    // console.log('oneScene = '+util.inspect(oneScene))
    // if (oneScene.multi) {
    // Нужно создавать экземпляры для каждого набора
    // } else {
    const id = oneScene.id;
    this.sceneSet[oneScene.id] = oneScene;
    this.holder.traceSet[id] = new Traco(id, {}, 'scen');
  }

  async removeScene(doc) {
    const sceneId = doc._id;
    this.holder.deviceWorker.postMessage({ name: 'remove:scene', data: { sceneId } });
    if (!this.sceneSet[sceneId]) return;

    // TODO Для multi нужно удалить ВСЕ экземпляры

    this.removeSceneItem(sceneId)
  }

  async removeSceneItem(sceneId) {
    this.removeSceneFromDevsceneSet(sceneId);
    this.sceneSet[sceneId] = '';
  }

  addDevsToDevsceneSet(doc, sceneId) {
    if (doc.devs && doc.def && sceneId) {
      const devs = doc.devs;
      const def = doc.def;
      try {
        const arr = devs.split(',').filter(el => el);
        arr.forEach(dev => {
          const dn = def[dev]; // Это м б объект!!
          this.addDnToDevsceneSet(dn, sceneId);
        });
      } catch (e) {
        console.log('ERROR: addDevsToDevsceneSet ' + util.inspect(doc) + ': ' + util.inspect(e));
      }
    }
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

 

  onUpdateSceneCall(doc) {
    console.log('WARN: onUpdateSceneCall doc=' + util.inspect(doc));
    if (!doc.$set) return;

    const scene = doc.sid;
    if (!scene) return;

    const sobj = this.getMultiScene(scene);
    // Удалить для предыдущего значения, добавить для нового
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

  // Включить сценарий устройства dn в this.devsceneSet (<key: dn> = Set [sceneid, ...])
  addDnToDevsceneSet(dn, sceneId) {
    if (!this.devsceneSet[dn]) this.devsceneSet[dn] = new Set();
    this.devsceneSet[dn].add(sceneId);
  }

  // При удалении сценария - удалить сценарий из всех ссылок d
  removeSceneFromDevsceneSet(sceneId) {
    Object.keys(this.devsceneSet).forEach(dn => {
      if (this.devsceneSet[dn].has(sceneId)) this.devsceneSet[dn].delete(sceneId);
    });
  }

  // При удалении устройства
  removeDnFromDevsceneSet(dn) {
    if (this.devsceneSet[dn]) delete this.devsceneSet[dn];
  }
}

module.exports = Scenengine;
