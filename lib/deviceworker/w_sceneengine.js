/**
 * w_sceneengine.js
 *
 *  Движок сценариев на стороне воркера
 *  - Обрабатывает сообщения о событиях от основного процесса, полученнные через wCore.on
 *    - события данных: 'changed:device:data',...,
 *    - события редактирования сценариев
 *
 *  - Формирует стр-ры для запуска сценариев (onChange, onSchedule, onInterval)
 *  - Запускает и отрабатывает сценарии
 */

const util = require('util');

const hut = require('../utils/hut');
const Sceno = require('./w_sceno');
const agent = require('./w_sceneagent');
const Scenedevo = require('../scene/scenedevo');

class Sceneengine {
  constructor(wCore, scenes) {
    this.wCore = wCore;
    this.globals = wrapGlobal(wCore.global);

    agent.start(wCore);

    this.sceneSet = {};
    this.wCore.sceneSet = this.sceneSet;
    this.triggersOnChange = {}; // {<dn>:{<prop>: new Set [scen001, scen004]}}

    // Сформировать сценарии
    Object.keys(scenes).forEach(id => {
      this.addScene(id, scenes[id]);
    });
  }

  start() {
    if (this.wCore.boot) {
      // Запустить сценарии, которые имеют startOnBoot
    }

    this.wCore.on('start:scene', data => {
      if (data.id) {
        this.startScene(data.id);
      } else {
        console.log('ERROR start:scene, missing id!');
      }
    });

    this.wCore.on('debugctl:scene', data => {
      if (data.uuid) {
        this.debugctl(data.mode, data.uuid.split('_').pop());
      } else {
        console.log('ERROR debug:scene, missing uuid!');
      }
    });

    this.wCore.on('changed:device:data', data => {
      // console.log('CHANGED '+util.inspect(data))
      this.runOnChange(data);
    });

    this.wCore.on('changed:globals', changed => {
      // Запуск сценариев при изменении глобальных переменных
      //  {did: 'gl002', prop:  'Test42',value: 135, ts: 1615487425742, changed: 1,prev: 134}
      const data = changed.map(item => ({ ...item, dn: 'globals' }));
      this.runOnChange(data);
    });

    // ******************************** События редактирования сценариев
    this.wCore.on('add:scene', data => {
      if (data.sceneId) {
        this.addScene(data.sceneId, data);
      }
    });

    this.wCore.on('update:scene', data => {
      //
      if (data.sceneId) {
        const id = data.sceneId;
        const debug = this.sceneSet[id].debug;
        this.removeScene(data.sceneId);
        // И добавить заново
        this.addScene(data.sceneId, data);
        this.sceneSet[id].debug = debug;
      }
    });

    this.wCore.on('remove:scene', data => {
      if (data.sceneId) {
        this.removeScene(data.sceneId);
      }
    });
  }

  /**
   *
   * @param {*} changed
   * Группировать изменения  - сценарий должен запуститься один раз
   *
   */
  runOnChange(changed) {
    const anyProp = '*';
    const toRun = {};

    const addToRun = (triggerSet, trigger, value) => {
      for (const sceneId of triggerSet) {
        if (this.sceneSet[sceneId]) {
          if (!toRun[sceneId]) toRun[sceneId] = { triggers: [], values: [] };
          toRun[sceneId].triggers.push(trigger);
          toRun[sceneId].values.push(value);
        }
      }
    };

    changed.forEach(item => {
      // TODO Могут быть слушатели - тогда запускаем их?
      if (item.dn && this.triggersOnChange[item.dn]) {
        // console.log('runOnChange '+util.inspect(changed)+' triggers='+util.inspect(this.triggersOnChange))
        if (this.triggersOnChange[item.dn][anyProp]) {
          addToRun(this.triggersOnChange[item.dn][anyProp], item.dn + '.' + item.prop, item.value);
        }
        if (this.triggersOnChange[item.dn][item.prop]) {
          addToRun(this.triggersOnChange[item.dn][item.prop], item.dn + '.' + item.prop, item.value);
        }
      }
    });

    // if (!toRun.size) return;
    if (!Object.keys(toRun).length) return;

    for (const id of Object.keys(toRun)) {
      this.startScene(id, toRun[id]); // TODO - передать триггеры
    }
  }

  /**
   * Попытаться запустить сценарий
   * @param {sceneId}
   *
   * Если сценарий не готов (уже запущен, блокирован) - пропускаем
   *  иначе пытаемся выполнить функцию?? которая проверяет входное условие??
   *  Если условие истинно, то запускается функция start
   *    Если start возвращает true, то сценарий остается активным
   *      иначе сценарий отработал и завершился
   *
   * сценарии могут слушать события, если активны - тогда проверяем listeners
   */
  /*
  attemptStartOrListen(sceneId, triggers) {
  
    
      try {
        if (this.sceneSet[sceneId].isReady()) {
          this.sceneSet[sceneId].triggers = triggers;
        // } else if (this.sceneSet[name].isActive() && this.sceneSet[name].listeners && this.sceneSet[name].listeners[dn]) {
        } else if (this.sceneSet[sceneId].isActive() && this.sceneSet[sceneId].listeners) {
          // Есть слушатель для устройства - запустить его
          // debugMsg(name, 'listener on event ' + dn + ': ' + sceneSet[name].listeners[dn]);
        
          tryExec(sceneId, sceneSet[sceneId].listeners[dn]);
        }
      } catch (e) {
        this.fixStop(name);
        sceneSet[name].chobj = '';
        workscenesUpdate({ id: name, active: 0, blk: 0, err: e.message });
        logErr(e, 'Run error. Scene ' + name + ' stopped');
      }
  }
  */

  addScene(id, scenObj) {
    try {
      console.log('WORKER addScene id=' + id + ' scenObj=' + util.inspect(scenObj));
      this.sceneSet[id] = new Sceno(scenObj, this.getActualParams(id, scenObj.devs, scenObj.def), agent);
      if (scenObj.starttriggers) {
        this.addToTriggers(scenObj, id);
      }
    } catch (e) {
      // Заблокировать сценарий с ошибкой параметров
    }
    // триггеры включить в
    // } else {
    // TODO - передать как ошибка сценария - на той стороне он есть
    // console.log('Not found id or filename in scenObj:' + util.inspect(sceneSet[id]));
    // }
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
    // const globals = wrapGlobal(this.wCore.global, sceneId);
    // const res = { globals: this.globals };
    const res = { globals: this.globals };

    if (devs && def) {
      const arr = devs.split(',').filter(el => el);
      arr.forEach(dev => {
        const dn = def[dev]; // Это м б объект!!??
        const dobj = this.wCore.dnSet[dn];
        // if (dobj) throw { message: 'Scene ' + sceneId + ' Not found device ' + util.inspect(dn) };
        // res[dev] = dobj;
        if (dobj) {
          res[dev] = new Scenedevo(dobj, sceneId, agent);
        }
      });
    }
    // console.log('getActualParams res='+util.inspect(res))
    return res;
  }

  addToTriggers(scenObj, sceneid) {
    // const trigger = scenObj.triggers;
    if (!scenObj.starttriggers) return;

    const arr = scenObj.starttriggers
      .split(',')
      .map(el => hut.allTrim(el))
      .filter(el => el);

    arr.forEach(el => {
      let [trigger, prop] = el.split('.');

      let dn;
      if (trigger == 'globals') {
        // dn = this.wCore.global.glByDn(prop); // dn=gl002, prop=guard ?
        if (prop) dn = 'globals';
      } else {
        if (!prop) prop = '*';
        dn = scenObj.def[trigger];
      }
      if (dn && prop) {
        if (!this.triggersOnChange[dn]) this.triggersOnChange[dn] = {};
        if (!this.triggersOnChange[dn][prop]) this.triggersOnChange[dn][prop] = new Set();
        this.triggersOnChange[dn][prop].add(sceneid);
      }
    });
    // console.log('addToTriggers this.triggersOnChange=' + util.inspect(this.triggersOnChange));
  }

  startScene(id, toRunItem) {
    if (!this.sceneSet[id]) return;
    if (!this.sceneSet[id].isReady()) return;
    agent.tryStart(id, toRunItem);
  }

  stopScene(id) {
    if (this.sceneSet[id]) {
      this.sceneSet[id].exit();
      agent.fixStop(id);
    }
  }

  /**  ON stopscene - интерактивный стоп сценария
   */
  onStopScene(query) {
    let id;

    if (typeof query == 'object') {
      id = query.id;
    } else {
      id = query;
    }
    if (this.sceneSet[id]) {
      this.sceneSet[id].exit();
      agent.fixStop(id);
    }
  }

  debugctl(mode, id) {
    if (!this.sceneSet[id]) return;

    this.sceneSet[id].debug = mode; // 0 || 1
    if (mode) {
      // Включена подписка - вывести текущее состояние
      agent.debug(id, this.getStatusStr(id));
    }
  }

  getStatusStr(id) {
    if (!this.sceneSet[id]) return 'Missing scene instanse: ' + id;
    if (this.sceneSet[id].isActive()) return 'Working';
    if (this.sceneSet[id].blk) return 'Blocked ' + (this.sceneSet[id].error || '');
    return 'Not active';
  }

  // При редактировании сценариев
  removeScene(id) {
    if (!this.sceneSet[id]) return;
    // Остановить сценарий, если запущен
    if (this.sceneSet[id].isActive()) this.stopScene();
    hut.unrequire(this.sceneSet[id].filename);

    this.sceneSet[id] = '';
  }
}

module.exports = Sceneengine;

function wrapGlobal(glSet) {
  return new Proxy(
    {},
    {
      get(target, prop) {
        return glSet.getValue(prop);
      },

      set(target, prop, value) {
        glSet.setValue(prop, value, { src: 'scene' });
        return true;
      }
    }
  );
}

/**
  *  scen002: {
    id: 'scen002',
    sceneId: 'scen002',
    blk: 0,
    multi: 0,
    error: '',
    filename: '/var/lib/intrahouse-d/projects/miheev_ih/scenes/req/scene_scen002.js',
    devs: 'motion,lamp',
    realdevs: 'DD101_1,H101_1',
    starttriggers: 'motion',
    def: { motion: 'DD101_1', lamp: 'H101_1' },
    active: 0,
    laststart: 0,
    laststop: 0,
    qstarts: 0
  }

  */
