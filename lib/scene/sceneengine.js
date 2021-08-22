/**
 * sceneengine.js на main
 * Фактически Сценарии запускает worker
 * Движок нужен для
 *  - поддержки редактирования сценариев - формируются экземпляры сценариев и отправляются на worker
 *  - отслеживания состояния (блокирован, ошибка) и интерактивного запуска-блокировки
 *  - ведения списка мультисценариев и их экземпляров
 *  - показа используемых устройствами сценариев
 *
 * Движок слушает события:
 *    'start:scene'  => worker
 *    'stop:scene'   => worker
 *    'debugctl'     => worker - переключение режима debug
 *
 *    'debug:scene'  <= worker - отладочные сообщения передаются на интерфейс
 *
 * События редактирования слушает scenemate
 *
 * Экземпляр сценария (holder.sceneSet[id])это анемичный объект без методов, описывающий экземпляр и его состояние
 *
 * Первоначальная загрузка сценариев на старте уже выполнена функцией loadscene
 *
 * holder.devsceneSet[dn] = Set['scene_001', '42',...] для показа, где участвует устройство
 *
 * На worker отправляются готовые экземпляры сценариев, для которых нет разницы multi/простой
 * Экземпляр работает с конкретными устройствами
 */

const util = require('util');

const hut = require('../utils/hut');
const sceneutils = require('./sceneutils');
const Traco = require('../device/traco');

class Scenengine {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;

    this.multis = {}; // Список мультисценариев <sceneId>: Set [массив id экземпляров этого сценария]

    this.sceneSet = {};
    holder.sceneSet = this.sceneSet; // Это экземпляры сценариев (простые и мульти)

    // Для показа используемых устройствами сценариев
    this.devsceneSet = {}; // 'd0011':Set {'mLight', 32,.
    holder.devsceneSet = this.devsceneSet;
  }

  start() {
    // holder.sceneSet уже заполнен с использованием  addSceneItem
    Object.keys(this.holder.sceneSet).forEach(sceneId => {
      this.addDevsToDevsceneSet(this.holder.sceneSet[sceneId], sceneId);
    });

    this.holder.on('start:scene', query => {
      this.holder.deviceWorker.postMessage({ name: 'start:scene', data: { id: query } });
    });

    this.holder.on('stop:scene', (query, callback) => {
      // this.stopScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        const id = uuid.split('_').pop();
        const multi = this.multis[id] ? 1 : 0;
        this.holder.deviceWorker.postMessage({ name: 'debugctl:scene', data: { mode, id, multi } });
      }
    });

    this.holder.on('debug:scene', data => {
      const { id, message } = data;
      this.holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + message);
    });
  }

  /** addScene
   * Добавление сценария динамически
   *  - добавляет экземпляр(ы) в sceneSet
   *  - передает добавленные экземпляр(ы) на worker
   *
   * @param {Object} doc - структура со сценарием
   * @param {Array of Objects} calls - наборы scenecall
   */
  addScene(doc, calls) {
    const data = this.addSceneItem(doc, calls);
    if (data.length) {
      this.holder.deviceWorker.postMessage({ name: 'add:scenes', data });
    }
  }

  /** addSceneItem
   * Добавление экземпляра(ов) в sceneSet
   *
   * Используется как при первой загрузке, так и динамически
   *
   * @param {Object} doc - структура со сценарием
   * @param {Array of Objects} calls - наборы scenecall
   * @return {Array of Objects} - добавленные экземпляры для передачи на worker
   */
  addSceneItem(doc, calls) {
    const oneScene = sceneutils.createSceneStruct(doc);

    if (oneScene.multi) {
      const arr = [];
      // Нужно создавать экземпляры для каждого набора Если экземпляров нет - ничего не создается?
      this.multis[oneScene.sceneId] = new Set(); // Создается заново
      if (calls && oneScene.def) {
        calls.forEach(call => {
          arr.push(this.addOneInstance(oneScene, call));
        });
      }
      return arr;
    }

    // TODO Проверить, что устройства существуют. Если нет - выставить ошибку и блокировать сценарий??
    const id = oneScene.id;
    this.sceneSet[id] = oneScene;
    this.holder.traceSet[id] = new Traco(id, {}, 'scen');
    return [oneScene];
  }

  /** addOneInstance
   * Добавление одного экземпляра мультисценария
   *
   * @param {Object} oneScene
   * @param {Object} call
   * @return {Object} - добавленный экземпляр
   */
  addOneInstance(oneScene, call) {
    const id = oneScene.sceneId + '#' + call._id;
    const oneInstance = hut.clone(oneScene);
    oneInstance.id = id;
    oneInstance.def = {};
    const dns = [];
    Object.keys(oneScene.def).forEach(formalDevice => {
      if (call[formalDevice]) {
        // здесь did, нужен dn
        const did = call[formalDevice];
        const dobj = this.holder.devSet[did];

        if (dobj) {
          oneInstance.def[formalDevice] = dobj.dn;
          dns.push(dobj.dn);
        } else {
          console.log('WARN: createOneInstance ' + id + ' NOT FOUND did=' + did);
        }
      }
    });

    oneInstance.realdevs = dns.join(',');
    this.sceneSet[id] = oneInstance;
    this.multis[oneScene.sceneId].add(id);
    this.holder.traceSet[id] = new Traco(id, {}, 'scen');
    return oneInstance;
  }

  addSceneCall(oneScene, call) {
    const oneInstance = this.addOneInstance(oneScene, call);
    this.holder.deviceWorker.postMessage({ name: 'add:scenes', data: [oneInstance] });
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

 

   /** removeScene
   * Удаление сценария
   *  - удаляет экземпляр, простой сценарий или весь мультисценарий
   *  - отправляет на worker массив экземпляров для удаления
   * @param {sid} id сценария (scen002 | scen002#call_001)
   */
  async removeScene(sid) {
    const sceneId = sceneutils.getSceneId(sid);
    let single;
    let unreq;
    if (sid == sceneId) {
      // Простой сценарий или весь мультисценарий
      unreq = true;
      if (!this.multis[sid])  single = sid;
    } else {
      // один экземпляр мультисценария
      single = sid;
    }

    
    if (single) {
      this.removeSceneItem(sceneId);
      this.holder.deviceWorker.postMessage({ name: 'remove:scenes', data: [{ id: sceneId }] });
    } else {
      const data = [];
      for (const id of this.multis[sceneId]) {
        // По всем экземплярам
        this.removeSceneItem(id);
        data.push({id})
      }
      if (data.length) {
        this.holder.deviceWorker.postMessage({ name: 'remove:scenes', data});
      }
    }

    if (unreq) this.holder.deviceWorker.postMessage({ name: 'unrequire:scene', sceneId});
  }

  async removeSceneItem(id) {
    this.removeSceneFromDevsceneSet(id);
    this.sceneSet[id] = '';
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
    const { hanid, blk, error, active, laststart, laststop, qstarts } = traceObj;
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
