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

    // Обертки
    this.globals = wrapGlobal(wCore.global);
    this.scenedevs = {}; // Обернутые в scenedevo устройства

    agent.start(wCore);
    this.sceneSet = {}; // Хранит рабочие экземпляры сценариев scen002, scen002#call_005 для мульти
    this.wCore.sceneSet = this.sceneSet;
    this.activeSet = new Set();

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

    this.wCore.on('stop:scene', data => {
      if (data.id) {
        this.stopScene(data.id);
      } else {
        console.log('ERROR stop:scene, missing id!');
      }
    });

    this.wCore.on('debugctl:scene', data => {
      // data = { mode, id, multi }
      if (data.id) {
        agent.debugctl(data.mode, data.id, data.multi);
      } else {
        console.log('ERROR debug:scene, missing id!');
      }
    });

    this.wCore.on('changed:device:data', data => {
      // console.log('CHANGED '+util.inspect(data))

      // Запуск незапущенных сценариев
      const wasRun = this.runOnChange(data); // Возвращает массив запущенных сценариев

      // Обработка слушателей активных сценариев
      if (agent.activeSet.size > 0) this.listenersOnChange(data, wasRun); //
    });

    this.wCore.on('changed:globals', changed => {
      // Запуск сценариев при изменении глобальных переменных
      //  {did: 'gl002', prop:  'Test42',value: 135, ts: 1615487425742, changed: 1,prev: 134}
      const data = changed.map(item => ({ ...item, dn: 'globals' }));
      this.runOnChange(data);
    });
  }

  /** runOnChange
   * Запуск сценариев по событию изменения устройств
   * @param {Array of Objects} changed -  массив изменений  [{dn prop, value},...]
   */
  runOnChange(changed) {
    const anyProp = '*';
    const toRun = {};
    // if (changed && changed[0].dn.startsWith('__U')) return;
    // console.log('runOnChange '+util.inspect(changed)+' this.triggersOnChange='+util.inspect(this.triggersOnChange))

    // Функция addToRun формирует объекты toRun[sceneId] = { triggers: [], values: [], dn_prop: [] }
    //   для каждого сценария, который будет запускаться
    // triggerSet содержит список сценариев, которые запускаются по dn+prop
    const addToRun = (triggerSet, dn, prop, value) => {
      for (const sceneId of triggerSet) {
        // Берем только неактивные сценарии!!
        if (this.sceneSet[sceneId] && !this.sceneSet[sceneId].isActive()) {
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

    // Группировать изменения  - сценарий должен запуститься один раз
    changed.forEach(item => {
      // TODO Могут быть слушатели - тогда запускаем их?
      if (item.dn && this.triggersOnChange[item.dn]) {
        if (this.triggersOnChange[item.dn][anyProp]) {
          addToRun(this.triggersOnChange[item.dn][anyProp], item.dn, item.prop, item.value);
        }
        if (this.triggersOnChange[item.dn][item.prop]) {
          addToRun(this.triggersOnChange[item.dn][item.prop], item.dn, item.prop, item.value);
        }
      }
    });

    if (!Object.keys(toRun).length) return {};

    for (const id of Object.keys(toRun)) {
      this.startScene(id, toRun[id]);
    }
    return toRun; // Сценарии, которые были запущены в текущей итерации
  }

  /** listenersOnChange
   * Отработка слушателей активных сценариев по событию изменения устройств
   * @param {Array of Objects} changed -  массив изменений  [{dn prop, value},...]
   * @param {Object} wasRun - сценарии, 
   *        запущенные в этой итерации - их не надо обрабатывать
   * 
   */
  listenersOnChange(changed, wasRun) {
    // if (changed && changed[0].dn.startsWith('__')) return;
    // console.log('listenersOnChange START ' + util.inspect(agent.activeSet)+' wasRun='+util.inspect(wasRun));
    for (const id of agent.activeSet) {
     
      if (!wasRun[id] && this.sceneSet[id] && this.sceneSet[id].listeners) {
        for (const listenerKey of Object.keys(this.sceneSet[id].listeners)) {
          
          if (this.sceneSet[id].listeners[listenerKey]) {
            const triggers = [];
            changed.forEach(item => {
              if (listenerKey == item.dn || listenerKey == item.dn + '.' + item.prop) {
                // Нужно отдать не реальное устройство а def
                const defdn = this.sceneSet[id].updef[item.dn]  || item.dn;
                triggers.push(defdn + '.' + item.prop);
              }
            });
           
            if (triggers.length) {
              agent.tryExec(id, this.sceneSet[id].listeners[listenerKey], triggers);
            }
          }
        }
      }
    }
  }

  /** startScene
   * Запуск сценария
   *
   * @param {String} id сценария
   * @param {Object} toRunItem - опционально - содержит инф-ю о триггерах  { triggers: [], values: [], dn_prop: [] };
   */
  startScene(id, toRunItem) {
    if (!this.sceneSet[id]) return;
    if (!this.sceneSet[id].isReady()) return;
    agent.tryStart(id, toRunItem);
  }

  /** stopScene
   * Останов сценария
   *
   * @param {String} id экземпляра сценария
   */
  stopScene(id) {
    if (!this.sceneSet[id]) return;
    this.sceneSet[id].exit();
    agent.fixStop(id);
  }

  /** addScene
   * Добавление экземпляра сценария
   *  - добавляет в this.sceneSet
   *  - добавляет расширенные свойства устройствам, если у сценария они есть
   *  - добавляет триггеры в список триггеров
   *
   * @param {*} id экземпляра сценария
   * @param {*} scenObj - анемичный объект, получен от main
   */
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
      this.wCore.postMessage('add:extprops:scene', { sceneId: id, extpropsByDn });
    }
  }

  /** getActualParams
   * Возвращает объект, который будет передаваться сценарию на старте
   *  Всегда содержит глобальный объект + обернутые устройства сценария
   *
   * @param {String} id
   * @param {String} devs - список устройств - список устройств сценария: 'lamp,sensor'
   *         (то что стоит перед Device: const lamp = Device("LAMP1"))
   * @param {Object} def - соответствие фактическим устройствам: {lamp:'LAMP1', sensor:'DD1'}
   *        Для мультисценария берется из экземпляра
   * @return {Object}
   */
  getActualParams(id, devs, def) {
    const res = { globals: this.globals };

    if (devs && def) {
      const arr = devs.split(',').filter(el => el);

      arr.forEach(dev => {
        const dn = def[dev]; // Это м б объект!!??
        const dobj = this.wCore.dnSet[dn];

        if (dobj) {
          if (!this.scenedevs[dn]) this.scenedevs[dn] = new Scenedevo(dobj, agent);
          res[dev] = this.scenedevs[dn];
        } else {
          console.log(id + ' getActualParams NOT FOUND dev=' + dev);
        }
      });
    }
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

  /** removeScene
   * Удаление экземпляра сценария
   *  - если сценарий запущен - останавливает его
   *  - удаляет все триггеры, связанные с этим сценарием
   *  - удаляет расширенные свойства устройств, добавленные сценарием
   *  - удаляет в this.sceneSet
   * Применяется при реальном удалении (простого сценария, экземпляра мульти )
   *  или при операции update
   *
   * @param {*} id экземпляра сценария
   */
  removeScene(id) {
    removeFromAllSet(this.triggersOnChange, id);
    if (!this.sceneSet[id]) return;

    const scenObj = this.sceneSet[id];
    if (scenObj.isActive()) this.stopScene(id); // Остановить сценарий, если запущен

    // hut.unrequire(scenObj.filename); 
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
