/**
 * globalset.js
 */

const util = require('util');
const appconfig = require('../appconfig');
const hut = require('../utils/hut');

class Globalset {
  constructor(holder) {
    this.holder = holder;
    this.dm = holder.dm;
    this.glSet = {}; // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.gldnSet = {}; // key= dn (просто указатель на объект в glSet dn=> did)
    this.triggersOnChange = {}; // {<dn>:{<prop>: new Set [gl001, gl001]}}
    this.handlersOnChange = {}; // {<gl_did>:function

    // Добавлены новые переменные
    holder.dm.on('inserted:globals', docs => {
      docs.forEach(doc => this.addItem(doc));
    });

    // Изменены переменные
    holder.dm.on('updated:globals', docs => {
      docs.forEach(doc => this.updateItem(doc));
    });

    // Удалены переменные
    holder.dm.on('removed:globals', docs => {
      docs.forEach(doc => this.removeItem(doc._id));
    });

    // Запуск обработчиков при изменении значений переменных
    holder.on('changed:device:data', changed => {
      this.runHandlersOnChange(changed);
    });
  }

  addItem(doc) {
    if (doc && doc.dn) {
      this.glSet[doc._id] = doc;
      this.glSet[doc._id].value = doc.defval;
      const dn = doc.dn;
      this.gldnSet[dn] = this.glSet[doc._id];

      // Может содержать обработчик, запускаемый по триггерам
      if (doc.scriptOnChange) {
        if (!this.handlersOnChange[doc._id]) this.handlersOnChange[doc._id] = {devs:{}, handler:''};
        this.addTriggers(doc);
        this.addHandler(doc._id); 
      } else {
        if (this.handlersOnChange[doc._id]) delete this.handlersOnChange[doc._id];
        unrequireHandler(doc._id)
      }
    }
  }

  addTriggers(doc) {
    if (!doc.scripttriggers) return;
    Object.keys(doc.scripttriggers).forEach(el => {
      if (doc.scripttriggers[el].devtrig) {
        const [did, prop] = doc.scripttriggers[el].devtrig.split('.');
        if (did && this.holder.devSet[did]) {
          addToSet(this.triggersOnChange, did, prop, doc._id);

          // В сценарии обращение по dn
          const dobj = this.holder.devSet[did];
          this.handlersOnChange[doc._id].devs[dobj.dn] = dobj;
        }
      }
    });
  }

  addHandler(gl_did) {
    this.handlersOnChange[gl_did].filename =  appconfig.getHandlerFilenameIfExists(gl_did);
   /*
    if (filename) {
      this.handlersOnChange[gl_did].handler = require(filename);
    }
    */
  }

  updateItem(doc) {
    if (doc.$set) {
      this.removeItem(doc._id);
      const newObj = Object.assign({}, doc, doc.$set);
      delete newObj.$set;

      // Удалить ссылки на обработчик для всех триггеров
      removeFromAllSet(this.triggersOnChange, doc._id);

      // Добавить заново
      this.addItem(newObj);
    }
  }

  removeItem(did) {
    removeFromAllSet(this.triggersOnChange, did);
    unrequireHandler(did);
    if (this.glSet[did]) {
      const dn = this.glSet[did].dn;
      if (dn) delete this.gldnSet[dn];
      delete this.glSet[did];
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
          if (this.handlersOnChange[gl_did]) toRun.add(gl_did);
        }
      }
    });

    if (!toRun.size)  return;
    for (const gl_did of toRun) {
      // Запуск функции 
      if (this.handlersOnChange[gl_did].filename) {
        const handler = require(this.handlersOnChange[gl_did].filename);
       
        const res = handler(this.getValue(gl_did), this.handlersOnChange[gl_did].devs);
        if (res != undefined)  this.setValue(gl_did, res);
      }
    }
  }

  getItem(id) {
    return id.startsWith('gl') ? this.glSet[id] : this.gldnSet[id];
  }

  setValue(id, value, sender) {
    const item = this.getItem(id);
    if (item) {
      if (item.value != value) {
        const prev = item.value;
        item.value = value;

        const did = item._id;
        const prop = item.dn;
        const ts = Date.now();
        this.holder.emit('changed:globals', [{ did, prop, value, ts, changed: 1, prev }]);

        if (item.log) {
          const logArr = [];
          if (sender) logArr.push({ did, prop, val: value, ts: ts - 1, cmd: 'set', ...sender });
          logArr.push({ did, prop, val: value, ts });
          this.holder.addLog('devicelog', logArr);
        }
      }
    } else {
      console.log('ERROR: Globalset var not found ' + id);
    }
  }

  getValue(id) {
    const item = this.getItem(id);
    return item ? item.value : 0;
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

function unrequireHandler(did) {
  const filename =  appconfig.getHandlerFilenameIfExists(did);
  hut.unrequire(filename)
}

module.exports = Globalset;
