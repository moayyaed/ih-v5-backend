/**
 * unito.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

class Unito {
  constructor(doc, manifest) {
    this.id = doc._id;
    this.setManifest(manifest);
    this.setDoc(doc); // Сохранить как есть все что пришло из документа (параметры плагина)
    this.plugin = this.doc.plugin;
    this.suspend = this.doc.suspend;

    // this.doc = doc;
    this.ps = 0;
    this.subs = new Map(); // Для подписок
    // this.charr = '';
    this.adapt(); // Если у плагина есть адаптер - загрузить его как набор функций
  }

  // Может подменяться из адаптера плагина
  writeTele(chanObj) {
    return chanObj;
  }

  setDoc(doc) {
    this.doc = hut.clone(doc);
  }

  setInfo(info) {
    this.info = hut.clone(info);
  }

  setManifest(manifest) {
    this.manifest = hut.clone(manifest);
  }

  getProp(prop) {
    return this.doc[prop] || '';
  }

  getManifestProp(prop) {
    return this.manifest ? this.manifest[prop] : '';
  }

  adapt() {
    const plugin = this.doc.plugin;
    if (!plugin) return;
    const adapter = appconfig.getPluginAdapterObj(plugin);
    if (!adapter) return;
    
    if (typeof adapter == 'object') {
      Object.keys(adapter).forEach(name => {
        if (typeof adapter[name] == 'function') {
          this[name] = adapter[name];
        }
      });
    }
  }

  /**
   * Возвращает массив id подписок в subs
   * subs = Map: key:'id1', value:{id, event:'tableupdated', filter:{tablename:'channels'}}
   * @param {*} event
   * @param {*} filter
   */
  getSubs(event, filter) {
    
    if (!this.subs.size) return [];

    const res = [];
    this.subs.forEach((value, key) => {
      if (value && value.event == event) {
        let need;
        // console.log('getSubs value='+util.inspect(value))
        /*
         value={
  id: 2,
  type: 'sub',
  event: 'tableupdated',
  filter: { tablename: 'channels', op: 'add', filter: '' }
}
      */

        if (filter) {
          // TODO - проверить фильтр
          if (value.filter && value.filter.op) {
            need = value.filter.op == filter.op;
          } 
        } else need = true;
        if (need) res.push(key);
      }
    });
    return res;
  }



  getModulepath() {
    // const module = this.manifest.module ? this.manifest.module : this.doc.plugin + '.js';
    const module = this.manifest.module ? this.manifest.module : 'index.js';
    return appconfig.getPluginModulePath(this.doc.plugin, module);
  }


  getArgs() {
    // Формировать аргументы командной строки
    
    const options = {
      id: this.id,
      logfile: appconfig.get('logpath') + '/ih_' + this.id + '.log'
    };
    return [JSON.stringify(options)];
    
    // return [this.id];
  }

  send(sendObj) {
    if (this.ps) this.ps.send(sendObj);
  }

  sendSigterm() {
    if (this.ps) {
      this.ps.kill('SIGTERM');
    }
    this.ps = 0;
    this.sigterm = 1;
  }
}

module.exports = Unito;
