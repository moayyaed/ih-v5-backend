/**
 * sceneengine.js
 *  Формирует
 *     -  extprops[sceneId][dev][prop] = {name, note, val, type,...}
 *        Расширенные свойства устройств,приходят от сценариев, используются устр-вами
 * 
 *     -  dnMainSet[dn] = Set['scene_001', '42',...]
 *        dnChildSet[dn] = Set['scene_001', '42',...]
 *        Карты связи устройств со сценариями отдельно для основного и дочернего
 *           для показа, где участвует устройство
 *           для child - для передачи данных устройств (слепок устройства, on('data'))
 *           mainengine сам слушает on('data')
 *
 *    - передает движкам команды  addscene, startscene, stopscene, blockscene, removescene
 *       сами запускают сценарии по триггерам,таймерам и слушателям
 *
 */

const util = require('util');


const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const datautil = require('../api/datautil');

class Scenengine {
  constructor(holder) {
    this.holder = holder;
  
    this.extprops = {}; // Расширенные свойства устройств - приходят от сценариев. В устройстве только ссылка на сценарий
    holder.extprops = this.extprops; // Здесь храним описание св-в: [sceneId][dev][prop] = {name, note, val, type,...}

    this.dnMainSet = {}; // 'd0011':Set {'mLight', 32,..]
 
    // Для показа используемых устройствами сценариев
    holder.devsceneSet = { main: this.dnMainSet, child: this.dnChildSet };
  }

  
  start() {
    this.holder.on('start:scene', (query, callback) => {
      // this.startScene(query, callback);
    });

    this.holder.on('stop:scene', (query, callback) => {
      // this.stopScene(query, callback);
    });

    this.holder.on('debugctl', (mode, uuid) => {
      if (uuid && uuid.startsWith('scene_') && !uuid.startsWith('scene_snippet')) {
        // this.debugctl(mode, uuid.split('_').pop());
      }
    });
  }

 
  /**
   * Сценарий добавлен динамически
   *  - добавляет объект в sceneSet
   *  - передает сообщение на worker, если это рабочий экземпляр
   * @param {} doc 
   */
  addScene(doc) {
   
    const sceneId = doc._id;
    const filename = appconfig.getReqScriptFilename(sceneId);
    console.log('addScene filename '+filename);
    
    // Если есть расширенные свойства - добавить в this.extprops
    if (doc.extprops) this.addExtprops(doc.extprops, sceneId);

    const blk = doc.blk || doc.err ? 1 : 0;
    const error = doc.err ? doc.errstr : '';

    if (!doc.multi) {
      this.adDevsToDnSet(doc, sceneId, doc.runInChild); // Устройства сценария
      this.upsertWorksceneItem(sceneId, { multi: 0, blk, error, sceneId });
      if (!blk) this.addSceneInstance(sceneId, doc, filename, doc.def);
      return;
    }

    // if (multi)  - нужны все экземпляры!! + создать worksceneSet item c индикатором multi
    this.upsertWorksceneItem(sceneId, { multi:1, blk, error, sceneId }); // Для этого элемена экземпляр не нужен
   
  }

  upsertWorksceneItem(id, { multi, blk, error, sceneId }) {
    const debug = this.worksceneSet[id] && this.worksceneSet[id].debug ? 1 : 0;
    this.worksceneSet[id] = new Worksceno({ id, sceneId, debug, blk, multi, error }, this.agent);
  }

  addSceneInstance(id, doc, filename, def) {
    if (doc.runInChild) {
      this.worksceneSet[id].child = 1;
      // Передать в дочерний процесс
      this.childEngine.send({ type: 'addscene', id, filename, doc });
    } else {
      try {
        const actualParams = this.getActualParams(doc.devs, def, doc.extprops, id);
        this.mainEngine.addScene(id, filename, actualParams);
      } catch (e) {
        // Ошибка при запуске - блокировать сценарий
        this.worksceneSet[id].blk = 1;
        this.worksceneSet[id].error = hut.getShortErrStr(e);
      }
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

    });

    return res;
  }

  

  startScene(query, callback) {
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
  stopScene(query, callback) {
    let id;

    if (typeof query == 'object') {
      id = query.id;
    } else {
      id = query;
    }

    if (this.worksceneSet[id].child) {
      this.fixStop(id);
      this.childEngine.send({ type: 'stopscene', id });
    } else {
      this.mainEngine.stopScene(id);
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



// Включить сценарий устройства dn в dnSet (хранить ссылки dn = [sceneid, ...]) 
function adOneDnToDnSet(dnSet, dn, sceneId) {
  if (!dnSet[dn]) dnSet[dn] = new Set();
  dnSet[dn].add(sceneId);
}

// При удалении сценария - удалить сценарий из всех ссылок dnSet 
function removeSceneFromDnSet(dnSet, sceneId) {
  Object.keys(dnSet).forEach(dn =>{
    if (dnSet[dn].has(sceneId)) dnSet[dn].delete(sceneId);
  })
  
}

// При удалении устройства ??? - удалить dnSet[dn] 
function removeOneDnFromDnSet(dnSet, dn) {
  if (dnSet[dn]) delete dnSet[dn];

}

module.exports = Scenengine;
