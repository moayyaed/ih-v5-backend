/**
 * mainengine.js
 * 
 * Движок сценариев, выполняемых в основном процессе
 *  -   
 *
 */
const util = require('util');

const { Sceno } = require('./sceno');
const Scenedevo = require('./scenedevo');
// const sceneutils = require('./sceneutils');

const hut = require('../utils/hut');
// const datautil = require('../api/datautil');

class Mainengine {
  constructor(holder, agent) {
    this.holder = holder;
    this.dm = this.holder.dm;
    this.agent = agent;
    
    this.sceneSet = {};
    this.triggersOnChange = {}; // {<dn>:{<prop>: new Set [scen001, scen004]}}
  }

  start() {
    // Запуск обработчиков при изменении значений переменных
    this.holder.on('changed:device:data', changed => {
      this.runOnChange(changed);
    });
  }

  // Простой экземпляр сценария
  // TODO - Для multi
  addSceneInstance(id, doc, filename, def) {
    try {
      const actualParams = this.getActualParams(id, doc.devs, def);
      this.sceneSet[id] = new Sceno(id, this.agent, filename, actualParams);
      this.addTriggers(id, doc.triggers, def);
      // console.log('addSceneInstance this.triggersOnChange='+util.inspect(this.triggersOnChange,null, 4))
    } catch (e) {
      // Ошибка при запуске - блокировать сценарий
      this.agent.setWorksceneStatus(id, { blk: 1, error: hut.getShortErrStr(e) });
      console.log('ERROR: Scene Error: ' + hut.getErrStrWoTrace(e));
    }
  }

  addTriggers(sceneId, triggers, def) {
    if (!triggers || !def) return;
    const arr = triggers.split(',').filter(el => el);
    arr.forEach(trigger => {
      let [dev, prop] = trigger.split('.');
      if (!prop) prop = '*';
      const dn = def[dev];

      if (dn && this.holder.dnSet[dn]) {
        addToSet(this.triggersOnChange, dn, prop, sceneId);
      }
    });
  }

  removeSceneInstance(id) {
    // Если запущен - нужно остановить!!
    delete this.sceneSet[id];
  }

  /**
   *
   * @param {String} sceneId
   * @param {String} devs - список устройств - список устройств сценария: 'lamp,sensor'
   *         (то что стоит перед Device: const lamp = Device("LAMP1"))
   *
   * @param {Object} def - соответствие фактическим устройствам: {lamp:'LAMP1', sensor:'DD1'}
   *        Для мультисценария берется из экземпляра
   */
  getActualParams(sceneId, devs, def) {
    const global = wrapGlobal(this.holder.glSet, sceneId);
    const res = { global };

    if (devs && def) {
      const arr = devs.split(',').filter(el => el);
      arr.forEach(dev => {
        const dn = def[dev]; // Это м б объект!!??
        const dobj = this.holder.dnSet[dn];
        if (!dobj) throw { message: 'Scene ' + sceneId + ' Not found device ' + util.inspect(dn) };

        res[dev] = new Scenedevo(dobj, sceneId, this.agent);
      });
    }

    return res;
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

  runOnChange(changed) {
    // Группировать изменения  - сценарий должен запуститься один раз
    const anyProp = '*';
    const toRun = new Set();
    changed.forEach(item => {
      if (item.dn && this.triggersOnChange[item.dn]) {
        if (this.triggersOnChange[item.dn][anyProp]) {
          addToRun(this.triggersOnChange[item.dn][anyProp]);
        }
        if (this.triggersOnChange[item.dn][item.prop]) {
          addToRun(this.triggersOnChange[item.dn][item.prop]);
        }
      }
    });

    if (!toRun.size) return;
    for (const sceneId of toRun) {
     
      
    }

    function addToRun(triggerSet) {
      for (const sceneId of triggerSet) {
        if (this.sceneSet[sceneId]) toRun.add(sceneId);
      }
    }
  }

   /**
   * Попытаться запустить сценарии, перечисленные в массиве
   * @param {Array of strings} sceneArr -  массив идентификаторов сценариев
   *
   * Если сценарий не готов (уже запущен, блокирован) - пропускаем
   *  иначе пытаемся выполнить функцию, которая проверяет входное условие
   *  Если условие истинно, то запускается функция start
   *    Если start возвращает true, то сценарий остается активным
   *      иначе сценарий отработал и завершился
   *
   * Эти же сценарии могут слушать события, если активны - тогда проверяем listeners
   */
  attemptStartOrListen(sceneArr) {
    if (!sceneArr) return;

    sceneArr.forEach(item => {
      const {name, chobj} = item;
      try {
        if (this.sceneSet[name].isReady()) {
          this.sceneSet[name].chobj = chobj;
          let checkresult;
          if (this.sceneSet[name].hasScript('check', 'function')) {
            checkresult = this.sceneSet[name].check();
            debugMsg(name, 'Check(' + dn + ') => ' + checkresult);
          } else {
            checkresult = true;
            debugMsg(name, 'Trigger ' + dn);
          }

          if (checkresult) {
            this.fixStart(name);
            this.sceneSet[name].start();

            if (!this.sceneSet[name].isPending()) {
              this.fixStop(name);
            }
          } else {
            this.sceneSet[name].chobj = '';
          }
        // } else if (this.sceneSet[name].isActive() && this.sceneSet[name].listeners && this.sceneSet[name].listeners[dn]) {
        } else if (this.sceneSet[name].isActive() && this.sceneSet[name].listeners) {
          // Есть слушатель для устройства - запустить его
          debugMsg(name, 'listener on event ' + dn + ': ' + sceneSet[name].listeners[dn]);
          sceneSet[name].chobj = chobj;
          tryExec(name, sceneSet[name].listeners[dn]);
        }
      } catch (e) {
        fixStop(name);
        sceneSet[name].chobj = '';
        workscenesUpdate({ id: name, active: 0, blk: 0, err: e.message });
        logErr(e, 'Run error. Scene ' + name + ' stopped');
      }
    });
  }



  onUpdateScene(doc) {}
}

// Private
function addToSet(obj, did, prop, sceneid) {
  if (!obj[did]) obj[did] = {};
  if (!obj[did][prop]) obj[did][prop] = new Set();
  obj[did][prop].add(sceneid);
}

function removeFromAllSet(obj, sceneid) {
  Object.keys(obj).forEach(did => {
    Object.keys(obj[did]).forEach(prop => {
      if (obj[did][prop] && obj[did][prop].has(sceneid)) obj[did][prop].delete(sceneid);
    });
  });
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
