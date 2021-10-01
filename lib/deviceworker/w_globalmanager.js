/**
 * w_globalmanager.js
 *  Объект глобальных переменных на стороне воркера
 *  - Содержит инф-ю о глобальных переменных и их текущие значения
 *    Присваивает новые значения глобальным переменным - setValue
 * 
 *    Передает сообщение 'accepted:globals' на main
 *    Генерирует событие 'changed:globals'  для запуска сценариев устройств при изменении глобальной переменной
 * 
 *  - Cобытия слушает w_globalmate и вызывает функции этого объекта
 */

const util = require('util');
const hut = require('../utils/hut');

class W_globalmanager {
  constructor(wCore) {
    this.wCore = wCore;

    this.glByDid = {}; // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.glByDn = {}; // key= dn (просто указатель на объект в glSet dn=> did)
    this.triggersOnChange = {}; // Для запуска обработчиков при изменении значений устройств
    // {<dn>:{<prop>: new Set [gl001, gl001]}} - по триггер.свойство
  }

  start() {
    // Если переменная имеет обработчик с триггерами-устройствами 
    // - регистрируем триггеры
    // - запускаем обработчик
    Object.keys(this.glByDid).forEach(id => {
      const item = this.glByDid[id];
      if (item.scriptOnChange && item.handler) {
        this.addTriggers(id, item.scripttriggers);
        this.execHandler(id);
      }
    });
  }

  getItem(id) {
    return id.startsWith('gl') ? this.glByDid[id] : this.glByDn[id];
  }

  // При присваивании - сразу принимается
  // генерируется событие для передачи и для отработки скриптов
  setValue(id, value, sender) {
    // console.log('w_globalmanager SET VALUE '+id+' value='+value)
    const item = this.getItem(id);
    if (item) {
      if (item.value != value) {
        const prev = item.value;
        item.value = value;

        const did = item._id;
        const prop = item.dn;
        const ts = Date.now();
        this.wCore.postMessage('accepted:globals', [{ did, prop, value, ts, changed: 1, prev }]);
        // console.log('wCore.postMessage accepted:globals '+did+' prop'+prop+' value='+value)
        // Для запуска сценариев устройств при изменении глобальной переменной
        this.wCore.emit('changed:globals', [{ did, prop, value, ts, changed: 1, prev }]);
      }
    } else {
      console.log('ERROR: Globalset var not found ' + id);
    }
  }

  getValue(id) {
    const item = this.getItem(id);
    if (item && item.value != undefined) {
      return isNaN(item.value) ? item.value : Number(item.value);
    }
    return 0;
  }

  updateItem(did, doc) {
    let curObj = '';
    if (this.glByDid[did] && this.glByDid[did].value != undefined) {
      curObj = { val: this.glByDid[did].value, ts: this.glByDid[did].ts, prev: this.glByDid[did].prev };
    }
    this.removeItem(did);

    // Добавить заново, значение сохранить
    this.addItem(did, {...doc, ...curObj});
  }

  removeItem(id) {
    if (this.glByDid[id]) {
      const dn = this.glByDid[id].dn;
      if (dn) delete this.glByDn[dn];
      delete this.glByDid[id];
    }

    // Удалить ссылки на обработчик этой переменной  для всех триггеров
    removeFromAllSet(this.triggersOnChange, id);
  }

  // Пришло вместе с данными
  addItem(id, doc) {
    if (!doc || !id) return;
    this.glByDid[id] = doc;

    this.glByDn[doc.dn] = this.glByDid[id];

    // Может содержать обработчик, запускаемый по триггерам
    // Всегда запускаем обработчик при регистрации триггеров
    if (doc.scriptOnChange && doc.handler && doc.handler.filename) {
      this.addTriggers(id, doc.scripttriggers);
      this.execHandler(id)
    }
  }

  addTriggers(gl_id, scripttriggers) {
    if (!gl_id || !scripttriggers || !this.glByDid[gl_id]) return;

    const glObj = this.glByDid[gl_id];
    glObj.devsParam = {};
    try {
      Object.keys(scripttriggers).forEach(el => {
        if (scripttriggers[el].devtrig) {
          const [did, prop] = scripttriggers[el].devtrig.split('.');
          if (did && this.wCore.devSet[did]) {
            addToSet(this.triggersOnChange, did, prop, gl_id);

            // В сценарии обращение по dn
            const dobj = this.wCore.devSet[did];
            glObj.devsParam[dobj.dn] = dobj;
          } else {
            console.log(scripttriggers[el].devtrig + ' NOT FOUND ' + did);
          }
        }
      });
    } catch (e) {
      console.log('ERROR: globals ' + gl_id + ' addTriggers: ' + util.inspect(e));
      // Блокировать обработчик, если произошли проблемы при загрузке?
      this.blkHandler(gl_id, hut.getErrStrWoTrace(e));
    }
  }

  runHandlersOnChange(changed) {
    // Группировать изменения  - обработчик должен запуститься один раз
    const toRun = new Set();
    changed.forEach(item => {
      if (
        item.did &&
        item.prop &&
        this.triggersOnChange[item.did] &&
        this.triggersOnChange[item.did][item.prop] // это Set
      ) {
        for (const gl_did of this.triggersOnChange[item.did][item.prop]) {
          toRun.add(gl_did);
        }
      }
    });
    if (!toRun.size) return;

    for (const id of toRun) {
      this.execHandler(id);
    }
  }

  execHandler(id) {
    // console.log('Try exec Handler for global '+id);
    const glObj = this.glByDid[id];
    const fn = this.getHandlerFunction(id, glObj.handler);
    if (fn) {
      const res = this.runHandler(id, id, fn);
      if (res != undefined) this.setValue(id, res);
    }
  }

  // Этот обработчик из другого не вызывается - currentScriptTs сразу уст
  runHandler(gl_id, hanid, fn) {
    // console.log('runDeviceHandler ' + hanid);
    const glObj = this.glByDid[gl_id];
    if (!glObj) return;
    try {
      if (fn) {
        const ts = Date.now();
        this.wCore.postMessage('trace:handler', { hanid, state: 1, ts });
        this.wCore.currentScriptTs = Date.now();

        const res = fn(glObj.value, glObj.devsParam);
        this.wCore.postMessage('trace:handler', { hanid, state: 0, ts: Date.now() });
        this.wCore.currentScriptTs = 0;
        return res;
      }
    } catch (e) {
      this.wCore.currentScriptTs = 0;
      this.blkHandler(gl_id,  hut.getErrStrWoTrace(e));
    }
  }

  // При require возможна синт ошибка
  getHandlerFunction(gl_id, handlerObj) {
    if (!handlerObj || handlerObj.blk) return '';

    try {
      if (!handlerObj.fn && handlerObj.filename) handlerObj.fn = require(handlerObj.filename);
      return handlerObj.fn;
    } catch (e) {
      this.blkHandler(gl_id, hut.getErrStrWoTrace(e));
    }
  }

  blkHandler(gl_id, error) {
    // блокировать этот обработчик - передать на main
    this.wCore.postMessage('trace:handler', { did: '', own: 'global', hanid: gl_id, state: 0, blk: 1, error });

    // Нужно у себя блокировать!!
    const glObj = this.glByDid[gl_id];
    if (!glObj || !glObj.handlerObj) return;

    glObj.handlerObj.blk = 1;
    glObj.handlerObj.error = 1;
    glObj.handlerObj.fn = '';
  }
}

// Private
function addToSet(obj, did, prop, gl_did) {
  if (!obj[did]) obj[did] = {};
  if (!obj[did][prop]) obj[did][prop] = new Set();
  obj[did][prop].add(gl_did);
}

function removeFromAllSet(obj, gl_did) {
  Object.keys(obj).forEach(did => {
    Object.keys(obj[did]).forEach(prop => {
      if (obj[did][prop] && obj[did][prop].has(gl_did)) obj[did][prop].delete(gl_did);
    });
  });
}

module.exports = W_globalmanager;
