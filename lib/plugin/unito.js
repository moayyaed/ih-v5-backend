/**
 * unito.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

class Unito {
  constructor(doc, manifest) {
    this.id = doc._id;
    this.manifest = manifest || {};
    this.setDoc(doc); // Сохранить как есть все что пришло из документа (параметры плагина)
    // this.doc = doc;
    this.ps = 0;
    this.subs = new Map(); // Для подписок
    this.charr = '';
  }

  setDoc(doc) {
    this.doc = hut.clone(doc);
  }

  setInfo(info) {
    this.info = hut.clone(info);
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
        if (filter) {
          // TODO - проверить фильтр
        }
        res.push(key);
      }
    });
    return res;
  }

  getModulepath() {
    const module = this.manifest.module ? this.manifest.module : this.doc.plugin + '.js';
    return appconfig.getPluginModulePath(this.doc.plugin, module);
  }

  getArgs() {
    // Формировать аргументы командной строки
    /*
    const options = {
      logfile: appconfig.get('logpath') + '/' + this.id + '.log'
    };
    return [JSON.stringify(options)];
    */
   return [this.id];
  }

  send(sendObj) {
    if (this.ps) this.ps.send(sendObj);
  }

  sendSigterm() {
    if (this.ps) {
      this.ps.kill('SIGTERM');
      this.ps = 0;
      this.sigterm = 1;
    }
  }
}

module.exports = Unito;
