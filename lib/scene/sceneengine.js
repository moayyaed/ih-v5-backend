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

// const appconfig = require('../appconfig');
const hut = require('../utils/hut');

// const datautil = require('../api/datautil');

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
      // console.log('MAIN ON debug:scene data=' + util.inspect(data));
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
    this.holder.deviceWorker.postMessage({ name: 'add:scene', data: this.sceneSet[sceneId] });
  }

  async updateScene(doc) {
    // удалить и заново добавить
    // doc:{ _id: 'scen003',}
    const sceneId = doc._id;
    // console.log('updateScene ' + util.inspect(doc));
    this.removeSceneItem(sceneId);
    this.addSceneItem(doc);
    this.holder.deviceWorker.postMessage({ name: 'update:scene', data: this.sceneSet[sceneId] });
  }

  addSceneItem(doc, calls) {
    const oneScene = sceneutils.createSceneStruct(doc);
    // { _id, id, sceneId, blk, multi, error, filename, devs, realdevs, starttriggers, def, extprops };
    // Пока sceneId = id - scen002
    // console.log('oneScene = '+util.inspect(oneScene))
    if (oneScene.multi) {
      // Нужно создавать экземпляры для каждого набора
      // Если экземпляров нет - ничего и не запускается
      console.log('oneScene = '+util.inspect(oneScene));
     

      if (calls && oneScene.def) {
        calls.forEach(call => {
          console.log('call = '+util.inspect(call));
          // {"_id":"call_002","sid":"scen002","motion":"d0051","lamp":"d0137"}
          const oneInstance = hut.clone(oneScene);
          const id = oneScene.sceneId+'#'+call._id;
          oneInstance.id = id;
          oneInstance.def = {};
          const dns = [];
          Object.keys(oneScene.def).forEach(formalDevice => {
            console.log('formalDevice = '+formalDevice);
            if (call[formalDevice]) {
               // здесь did, нужен dn
              const did = call[formalDevice];
              console.log('did = '+did);
              const dobj = this.holder.devSet[did];

              if (dobj) {
                oneInstance.def[formalDevice] = dobj.dn;
                dns.push(dobj.dn);
              } else {
                console.log('NOT FOUND did='+did)
              }
            }
          })

          oneInstance.realdevs = dns.join(','); 
          console.log(id+' oneInstance = '+util.inspect(oneInstance));
         
          this.sceneSet[id] = oneInstance;
          this.holder.traceSet[id] = new Traco(id, {}, 'scen');
        });
      }
    } else {
      // TODO Проверить, что устройства существуют. Если нет - выставить ошибку и блокировать сценарий??

      const id = oneScene.id;
      this.sceneSet[id] = oneScene;
      this.holder.traceSet[id] = new Traco(id, {}, 'scen');
    }
  }

  getCallDef(def, call) {
    const res = {};
    Object.keys(def).forEach(formalDevice => {
      if (call[formalDevice]) {
        // здесь did, нужен dn
        const did = call[formalDevice];
        const dobj = this.holder.devSet[did];

        if (dobj) {
          // Устройства нет - запуск экземпляра блокируется??

        }
      }
    });
  }

  async removeScene(doc) {
    const sceneId = doc._id;
    this.holder.deviceWorker.postMessage({ name: 'remove:scene', data: { sceneId } });
    if (!this.sceneSet[sceneId]) return;

    // TODO Для multi нужно удалить ВСЕ экземпляры

    this.removeSceneItem(sceneId);
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

  receivedTrace(traceObj) {
    const { hanid, blk, error, sceneId, active, laststart, laststop, qstarts } = traceObj;
    if (!this.sceneSet[hanid]) {
      console.log('Not found sceneSet ' + hanid);
      return;
    }

    this.sceneSet[hanid].active = active || 0;
    this.sceneSet[hanid].blk = blk || 0;
    this.sceneSet[hanid].error = error || '';
    this.sceneSet[hanid].laststart = laststart || '';
    this.sceneSet[hanid].laststop = laststop || '';
    this.sceneSet[hanid].qstarts = qstarts || 0;
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
