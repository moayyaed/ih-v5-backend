/**
 * w_globalmanager.js
 */

const util = require('util');
const hut = require('../utils/hut');

class Globalmanager {
  constructor(wCore) {
    this.wCore = wCore;

    this.glByDid = {}; // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.glByDn = {}; // key= dn (просто указатель на объект в glSet dn=> did)
    this.triggersOnChange = {}; // Для запуска обработчиков при изменении значений устройств
    // {<dn>:{<prop>: new Set [gl001, gl001]}} - по триггер.свойство

    // this.devsParam = {}; // Для переменных с обработчиком по gl_did: устройства - параметры для запуска обработчика
    // {<gl_did>:   {DD1:<dobj>, ..}
  }

  start() {
    Object.keys(this.glByDid).forEach(id => {
      const item = this.glByDid[id];
      if (item.scriptOnChange && item.handler) {
        // this.addTriggers(id, item.scripttriggers);
      }
    });

    this.wCore.on('changed:device:data', data => {
      this.runHandlersOnChange(data);
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
      curObj =  { val: this.glByDid[did].value, ts: this.glByDid[did].ts, prev: this.glByDid[did].prev }
    }
    this.removeItem(did);

    // Добавить заново
    this.addItem(did, doc, curObj);
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
    if (doc.scriptOnChange && doc.handler && doc.handler.filename) {
      this.addTriggers(id, doc.scripttriggers);
    }
  }

  addTriggers(gl_id, scripttriggers) {
    if (!gl_id || !scripttriggers || !this.glByDid[gl_id]) return;

    const glObj = this.glByDid[gl_id];
    glObj.devsParam = {};

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
      const glObj = this.glByDid[id];
      const fn = this.getHandlerFunction(id, glObj.handler);
      if (fn) {
        const res = this.runHandler(id, id, fn);
        if (res != undefined) this.setValue(id, res);
      }
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

        // const res = fn(glObj.value);
        const res = fn(glObj.value, glObj.devsParam);
        this.wCore.postMessage('trace:handler', { hanid, state: 0, ts: Date.now() });
        this.wCore.currentScriptTs = 0;
        return res;
      }
    } catch (e) {
      this.wCore.currentScriptTs = 0;
      // блокировать этот обработчик - передать на main
      this.wCore.postMessage('trace:handler', { hanid, state: 0, blk: 1, error: hut.getErrStrWoTrace(e) });

      // Нужно у себя блокировать!!
      glObj.handler.blk = 1;
      glObj.handler.error = 1;
      glObj.handler.fn = '';
    }
  }

  // При require возможна синт ошибка
  getHandlerFunction(did, handlerObj) {
    if (!handlerObj || handlerObj.blk) return '';

    try {
      if (!handlerObj.fn && handlerObj.filename) handlerObj.fn = require(handlerObj.filename);
      return handlerObj.fn;
    } catch (e) {
     
      // блокировать этот обработчик - передать на main
      this.wCore.postMessage('trace:handler', {
        did: '',
        own: 'global',
        hanid: did,
        state: 0,
        blk: 1,
        error: hut.getErrStrWoTrace(e)
      });

      // Нужно у себя блокировать!!
      handlerObj.blk = 1;
      handlerObj.error = 1;
      handlerObj.fn = '';
    }
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

module.exports = Globalmanager;
