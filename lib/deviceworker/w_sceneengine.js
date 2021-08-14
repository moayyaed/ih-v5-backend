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

    this.sceneExtprops = {}; // {<sceneId>:{<dn:{<prop>:{name, note, ...}}}}
    this.wCore.sceneExtprops = this.sceneExtprops;

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

    const addToRun = (triggerSet, dn, prop, value) => {
      for (const sceneId of triggerSet) {
        if (this.sceneSet[sceneId]) {
          if (!toRun[sceneId]) toRun[sceneId] = { triggers: [], values: [], dn_prop: [] };

          toRun[sceneId].dn_prop.push(dn + '.' + prop);
          toRun[sceneId].values.push(value);

          // Для устройства найти переменную
          //   def: { motion: 'DD101_1', lamp: 'H101_1' },
          //   updef: { 'DD101_1':'motion', H101_1:'lamp' },
          const trigger = this.sceneSet[sceneId].updef[dn] || dn;
          toRun[sceneId].triggers.push(trigger + '.' + prop);
        }
      }
    };

    changed.forEach(item => {
      // TODO Могут быть слушатели - тогда запускаем их?
      if (item.dn && this.triggersOnChange[item.dn]) {
        // console.log('runOnChange '+util.inspect(changed)+' triggers='+util.inspect(this.triggersOnChange))
        if (this.triggersOnChange[item.dn][anyProp]) {
          addToRun(this.triggersOnChange[item.dn][anyProp], item.dn, item.prop, item.value);
        }
        if (this.triggersOnChange[item.dn][item.prop]) {
          addToRun(this.triggersOnChange[item.dn][item.prop], item.dn, item.prop, item.value);
        }
      }
    });

    // if (!toRun.size) return;
    if (!Object.keys(toRun).length) return;

    for (const id of Object.keys(toRun)) {
      this.startScene(id, toRun[id]); // TODO - передать триггеры
    }
  }

  addScene(id, scenObj) {
    try {
      this.sceneSet[id] = new Sceno(scenObj, this.getActualParams(id, scenObj.devs, scenObj.def), agent);
      this.addExtProps(id, scenObj);
      this.addToTriggers(scenObj, id);
    } catch (e) {
      // TODO Заблокировать сценарий с ошибкой параметров
    }
  }

  addExtProps(id, scenObj) {
    if (typeof scenObj.extprops == 'object' && typeof scenObj.def == 'object') {
      const extpropsByDn = {};
      Object.keys(scenObj.extprops).forEach(formalDevice => {

        // Добавить устройству (вам)
        const dn = scenObj.def[formalDevice];
        const devExtProps = scenObj.extprops[formalDevice];
        const dobj = this.wCore.dnSet[dn];
        if (dobj) dobj.addExtProps(devExtProps, id);
        extpropsByDn[dn] = devExtProps;

        // Добавить в общий список расширенных свойств - каждое свойство отдельно
        if (!this.sceneExtprops[id]) this.sceneExtprops[id] = {};
        if (!this.sceneExtprops[id][dn]) this.sceneExtprops[id][dn] = {};
        devExtProps.forEach(item => {
          const prop = item.name;
          this.sceneExtprops[id][dn][prop] = { ...item };
        });
      });
      this.wCore.postMessage('add:extprops:scene', {sceneId:id, extpropsByDn });
    }
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
    if (!scenObj || !scenObj.starttriggers) return;

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

  // При удалении сценария
  removeScene(id) {
    removeFromAllSet(this.triggersOnChange, id);

    if (!this.sceneSet[id]) return;
    const scenObj = this.sceneSet[id];
    if (scenObj.isActive()) scenObj.stopScene(); // Остановить сценарий, если запущен

    hut.unrequire(scenObj.filename);
    this.deleteExtProps(id, scenObj);
    this.sceneSet[id] = '';
  }

  deleteExtProps(id, scenObj) {
    if (!scenObj.extprops || !scenObj.def) return;
    const extpropsByDn = {};
      Object.keys(scenObj.extprops).forEach(formalDevice => {
        // Удалить из устройства
        const dn = scenObj.def[formalDevice];
        const dobj = this.wCore.dnSet[dn];
        if (dobj) dobj.deleteExtProps(id);
        extpropsByDn[dn] = 1; // Удалить все для этого сценария

        // Удалить из списка расширенных свойств - в целом для сценария
        this.sceneExtprops[id] = '';
      });

      this.wCore.postMessage('remove:extprops:scene', { extpropsByDn, sceneId: id });
    
  }

  // Запуск - останов
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

// Удаление элементов из объектов типа {<did>:{<prop>: Set [id1, id2, ...]
// TODO Поместить в hut?
function removeFromAllSet(obj, id) {
  Object.keys(obj).forEach(did => {
    Object.keys(obj[did]).forEach(prop => {
      if (obj[did][prop] && obj[did][prop].has(id)) obj[did][prop].delete(id);
    });
  });
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
