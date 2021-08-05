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
  constructor(wCore, sceneSet) {
    this.wCore = wCore;
    this.globals = wrapGlobal(wCore.global);

    agent.start(wCore);

    // Сформировать сценарии
    this.sceneSet = {};
    this.wCore.sceneSet = this.sceneSet;
    Object.keys(sceneSet).forEach(id => {
      this.addScene(id, sceneSet[id]);
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
    });

    // TODO Запуск сценариев при изменении глобальных переменных
    this.wCore.on('changed:globals', changed => {
      //
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

  addScene(id, scenObj) {
    try {
      // console.log('WORKER addScene id='+id+' scenObj='+util.inspect(scenObj))
      this.sceneSet[id] = new Sceno(scenObj, this.getActualParams(id, scenObj.devs, scenObj.def), agent);
    } catch (e) {
      // Заблокировать сценарий с ошибкой параметров
    }
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

  startScene(id) {
    if (!this.sceneSet[id]) {
      console.log('Not found scene ' + id);
      return;
    }
    if (!this.sceneSet[id].isReady()) {
      console.log('startScene not ready!');
      return;
    }

    let active = 1;
    const ts = Date.now();

    const traceObj = { hanid: id, sceneId: this.sceneSet[id].sceneId, active, state: 1, ts };
    this.fixStart(id);
    this.wCore.currentScriptTs = ts;
    try {
      this.postTrace(id, traceObj);
      this.sceneSet[id].start(); // Запуск функции start из скрипта

      // Синхронная часть завершилась
      if (!this.sceneSet[id].isPending()) {
        this.fixStop(id);
        active = 0;
      }
    } catch (e) {
      const error = hut.getErrStrWoTrace(e);
      this.fixStop(id, error);
      agent.debug(id, 'Blocked with run-time error: ' + error);
      
    }
    this.postTrace(id, { ...traceObj, state: 0, ts: Date.now(), active });
    this.wCore.currentScriptTs = 0;
  }

  postTrace(id, traceObj) {
    const { sceneId, laststart, laststop, qstarts, blk, error } = this.sceneSet[id];
    this.wCore.postMessage('trace:handler', {
      hanid: id,
      ...traceObj,
      blk,
      error,
      sceneId,
      laststart,
      laststop,
      qstarts
    });
  }

  stopScene(id) {
    if (this.sceneSet[id]) {
      this.sceneSet[id].exit();
      this.fixStop(id);
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
      this.fixStop(id);
    }
  }

  fixStart(id, sender) {
    if (!this.sceneSet[id].isActive()) {
      let ts = Date.now();
      this.sceneSet[id].__started(ts);
      if (sender) this.sceneSet[id].sender = sender;
    }
  }

  fixStop(id, error) {
    // TODO Удалить все алерты этого сценария,
    // слушатели и таймеры удаляются в stopped

    this.sceneSet[id].chobj = '';
    let ts = Date.now();
    this.sceneSet[id].__stopped(ts);
    this.sceneSet[id].sender = '';
    if (error) {
      this.sceneSet[id].error = error;
      this.sceneSet[id].blk = 1;
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
    triggers: 'motion',
    def: { motion: 'DD101_1', lamp: 'H101_1' },
    active: 0,
    laststart: 0,
    laststop: 0,
    qstarts: 0
  }

  */