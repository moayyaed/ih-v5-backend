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

    this.multis = {}; // Список мультисценариев <sceneId>: Set [массив callId экземпляров этого сценария]

    // Экземпляр сценария sceneSet[id] -это анемичный объект без методов, описывающий экземпляр и его состояние
    this.sceneSet = {};
    holder.sceneSet = this.sceneSet;

    // Для показа используемых устройствами сценариев
    this.devsceneSet = {}; // 'd0011':Set {'mLight', 32,.
    holder.devsceneSet = this.devsceneSet;
  }

  // Первоначальная загрузка сценариев уже выполнена функцией loadscene с использованием  addSceneItem
  start() {
    Object.keys(this.holder.sceneSet).forEach(sceneId => {
      this.addDevsToDevsceneSet(this.holder.sceneSet[sceneId], sceneId);
    });

    this.holder.on('start:scene', query => {
      this.holder.deviceWorker.postMessage({ name: 'start:scene', data: { id: query } });
    });

    this.holder.on('stop:scene', query => {
      this.holder.deviceWorker.postMessage({ name: 'stop:scene', data: { id: query } });
    });

    // Отправить флаг отладки от клиента на worker
    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        const id = uuid.split('_').pop();
        const multi = this.multis[id] ? 1 : 0;
        this.holder.deviceWorker.postMessage({ name: 'debugctl:scene', data: { mode, id, multi } });
      }
    });

    // Отдать отладочное сообщение с worker на клиент
    this.holder.on('debug:scene', data => {
      const { id, message } = data;
      this.holder.emit('debug', 'scene_' + id, message);
    });
  }

  /** addScene
   * Добавление сценария динамически
   *  - добавляет экземпляр(ы) в sceneSet
   *  - передает добавленные экземпляр(ы) на worker
   *
   * @param {Object} doc - структура со сценарием
   * @param {Array of Objects} calls - наборы из таблицы scenecall
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
   * @param {Array of Objects} calls - наборы из scenecall
   *   [{"_id":"call_005","sid":"scen019","id":"__zQ-25SQWe","lamp":"d0004","motion":"d0051"},..]
   *
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
   * - формирует id экземпляра и сам экземпляр
   * - добавляет в  sceneSet, multis, traceSet
   * - возвращает добавленный экземпляр
   * 
   * @param {Object} oneScene - структура, содержащая сценарий
   *   {_id: 'scen019',id: 'scen019', sceneId: 'scen019', blk: 0, multi: 1, error: '',
       filename: '/var/lib/intrahouse-d/projects/miheev_ih/scenes/req/scene_scen019.js',
       devs: 'lamp,motion', realdevs: '', starttriggers: 'motion,lamp',
       def: {
        lamp: { cl: 'Светильник', note: 'Светильник' },
        motion: { cl: 'Датчик движения', note: 'Датчик движения' }
      },
      extprops: {
        lamp: [{    name: 'timeoff',note: 'Время до выключения, сек',type: 'time',val: 30}]
      },
      active: 0, laststart: 0, laststop: 0, qstarts: 0}

   * @param {Object} call - набор экземпляра
   *   {"_id":"call_005","sid":"scen019","lamp":"d0004","motion":"d0051"}
   * 
   * @return {Object} - добавленный экземпляр
   *   Изменяется id! Заполняются устройства в realdevs,  def
   * 
   *   id: 'scen019#call_007', sceneId: 'scen019', blk: 0, multi: 1, error: '',
       filename: '/var/lib/intrahouse-d/projects/miheev_ih/scenes/req/scene_scen019.js',
       devs: 'lamp,motion', realdevs: 'H106_5,DD106_1', starttriggers: 'motion,lamp',
       def: { lamp: 'H106_5', motion: 'DD106_1' },
       extprops: {
        lamp: [{    name: 'timeoff',note: 'Время до выключения, сек',type: 'time',val: 30}]
      },
    },
     active: 0, laststart: 0, laststop: 0, qstarts: 0}
   */
  addOneInstance(oneScene, call) {
    console.log('addOneInstance oneScene=' + util.inspect(oneScene, null, 4) + ' call=' + util.inspect(call));
    try {
      if (!oneScene) throw { message: 'Missing scene for call ' + util.inspect(call) };
      if (!call) throw { message: 'Missing call for scene ' + util.inspect(oneScene) };

      const id = sceneutils.getOneInstanceId(oneScene.sceneId, call._id);
      const oneInstance = hut.clone(oneScene);
      oneInstance.id = id;
      oneInstance.def = {};
      const dns = [];
      if (oneScene.def) {
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
      }
      oneInstance.realdevs = dns.join(',');

      this.sceneSet[id] = oneInstance;
      this.multis[oneScene.sceneId].add(call._id);
      this.holder.traceSet[id] = new Traco(id, {}, 'scen');
      console.log('addOneInstance oneInstance=' + util.inspect(oneInstance, null, 4));
      return oneInstance;
    } catch (e) {
      console.log('ERROR: addOneInstance skipped! ' + e.message);
    }
  }

  /** removeScene
   * Удаление сценария в целом (простой сценарий или все экземпляры мульти)
   *  - отправляет на worker массив экземпляров для удаления
   *
   * @param {String} sid сценария (scen002 | scen002#call_001)
   */
  async removeScene(sid) {
    const sceneId = sceneutils.getSceneId(sid);
    let single;
    let unreq;
    const data = [];

    if (sid == sceneId) {
      // Простой сценарий или весь мультисценарий
      unreq = sceneId;
      if (!this.multis[sid]) single = sid;
    } else {
      // один экземпляр мультисценария
      single = sid;
    }
    console.log('SCENEENGINE removeScene ' + sid + ' single=' + single + ' unreq=' + unreq);
    if (single) {
      const item = this.removeOneInstance(sid);
      if (item) data.push(item);
    } else {
      for (const callId of this.multis[sceneId]) {
        const item = this.removeOneInstance(callId);
        if (item) data.push(item);
      }
    }

    if (data.length) {
      this.holder.deviceWorker.postMessage({ name: 'remove:scenes', data });
    }
    if (unreq) {
      const filename = sceneutils.getFilenameForUnreq(sceneId);
      this.holder.deviceWorker.postMessage({ name: 'unrequire:scene', data: { filename } });
    }
  }

  async updateScene(doc, calls) {
    // удалить и заново добавить - один экземпляр или все для мульти
    // doc:{ _id: 'scen003',}
    const sceneId = doc._id;
    if (calls) {
      calls.forEach(call => {
        call.id = sceneutils.getOneInstanceId(sceneId, call._id);
      });
    }
    console.log('SCENEENGINE updateScene calls=' + util.inspect(calls));

    // console.log('updateScene ' + util.inspect(doc));
    this.removeScene(sceneId);

    const data = this.addSceneItem(doc, calls);
    if (data && data.length) {
      this.holder.deviceWorker.postMessage({ name: 'update:scenes', data });
    }
  }

  /** addSceneCall
   * Добавление одного экземпляра, отправка на worker
   * @param {Object} oneScene
   * @param {Object} call
   */
  addSceneCall(oneScene, call) {
    const oneInstance = this.addOneInstance(oneScene, call);
    if (oneInstance) {
      this.holder.deviceWorker.postMessage({ name: 'add:scenes', data: [oneInstance] });
    }
  }

  /** removeSceneCall
   * Удаление одного экземпляра, отправка на worker
   *
   * @param {String} callId - id из документа таблицы scenecall без привязки к сценарию : 'call_004'
   */
  removeSceneCall(callId) {
    const sceneId = this.findSceneIdForCallId(callId);
    if (!sceneId) {
      console.log('ERROR: removeSceneCall. Not found sceneId for scenecall=' + callId + '. Skipped');
      return;
    }

    const id = sceneutils.getOneInstanceId(sceneId, callId);
    const item = this.removeOneInstance(id);
    if (item) {
      console.log('SCENEENGINE emit remove:scenes.item=' + util.inspect(item));
      this.holder.deviceWorker.postMessage({ name: 'remove:scenes', data: [item] });
    }
  }

  /** removeOneInstance
   * Удаление одного экземпляра сценария/мультисценария
   *  - возвращает объект для передачи команды удаления на worker
   * @param {String} id экземпляра
   *
   */
  removeOneInstance(id) {
    this.removeSceneFromDevsceneSet(id);
    this.sceneSet[id] = '';
    return { id };
  }

  findSceneIdForCallId(callId) {
    for (const sceneId of Object.keys(this.multis)) {
      if (this.multis[sceneId].has(callId)) return sceneId;
    }
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
    const { hanid, blk, error, active, state, laststart, laststop, qstarts } = traceObj;
    if (!this.sceneSet[hanid]) {
      console.log('ERROR: receivedTrace. Not found sceneSet ' + hanid);
      return;
    }
    this.sceneSet[hanid].active = active || 0;
    this.sceneSet[hanid].blk = blk || 0;
    this.sceneSet[hanid].error = error || '';
    this.sceneSet[hanid].laststart = laststart || '';
    this.sceneSet[hanid].laststop = laststop || '';
    this.sceneSet[hanid].qstarts = qstarts || 0;
    this.sceneSet[hanid].state = state;
  }

  // Включить сценарий устройства dn в this.devsceneSet (<key: dn> = Set [sceneid, ...])
  addDnToDevsceneSet(dn, sceneId) {
    if (!this.devsceneSet[dn]) this.devsceneSet[dn] = new Set();
    this.devsceneSet[dn].add(sceneId);
  }

  // При удалении сценария - удалить сценарий из всех ссылок devsceneSet
  removeSceneFromDevsceneSet(sceneId) {
    Object.keys(this.devsceneSet).forEach(dn => {
      if (this.devsceneSet[dn].has(sceneId)) this.devsceneSet[dn].delete(sceneId);
    });
  }

  // TODO При удалении устройства - НЕ ВЫЗЫВАЕТСЯ!!
  removeDnFromDevsceneSet(dn) {
    if (this.devsceneSet[dn]) delete this.devsceneSet[dn];
  }
}

module.exports = Scenengine;
