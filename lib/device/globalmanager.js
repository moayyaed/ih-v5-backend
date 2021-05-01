/**
 * globalmanager.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

class Globalmanager {
  constructor(holder) {
    this.holder = holder;
    this.glByDid = {}; // key= _id (did), содержит всю инф-ю, [did].value - текущее значение
    this.glByDn = {}; // key= dn (просто указатель на объект в glByDid dn=> did)
  }

  /**
   * Добавление переменной и установка значения
   *  - в зависимости от флага setdef - выполняется заполнение дефолтным значением или сохраненным
   * @param {} did 
   * @param {*} doc 
   * @param {*} dataCurrent 
   */
  addItem(did, doc, dataCurrent = {}) {
    if (!doc || !did) return;
    this.glByDid[did] = doc;
    if (doc.scriptOnChange) {
      this.glByDid[did].handler = {blk:0, error:'', filename: appconfig.getHandlerFilenameIfExists(did)};
    }
    // console.log('GLOBAL addItem '+did+' defval='+doc.defval+util.inspect(doc))

    if (!doc.setdef && dataCurrent && dataCurrent.val != undefined) {
      this.glByDid[did].value = dataCurrent.val;
      this.glByDid[did].ts = dataCurrent.ts;
      this.glByDid[did].prev = dataCurrent.prev;
    } else {
      this.glByDid[did].value = doc.defval;
    }

    this.glByDn[doc.dn] = this.glByDid[did];

    // Записать в журнал, если он ведется
    return doc.save ? { did, prop: doc.dn, val:this.glByDid[did].value, ts: Date.now() } : '';
  }

  getItem(id) {
    return id.startsWith('gl') ? this.glByDid[id] : this.glByDn[id];
  }

  comply({ did, ts, value, sender }) {
    // Соглашаемся с присланным с worker-a значением, события уже сгенерированы
    if (!did) return {};
    const item = this.getItem(did);
    if (!item) return {};

    item.ts = ts;
    item.prev = item.value;
    item.value = value;
    item.ts = ts;
    return { did, prop: item.dn, val: value, ts }; // Вернуть для записи в журнал и в glcurrent
  }

  needSaveToLog(id) {
    const item = this.getItem(id);
    return item && item.save;
  }

  // Если setdef=1 (Присваивать деф при старте, то current не храним - он не нужен
  needSaveToCurrent(id) {
    const item = this.getItem(id);
    return item ? !item.setdef : false;
  }

  // setValue - только через worker
  // Значение также может измениться через сценарий на worker-e!!
  // setValue(id, value, sender) {

  getValue(id) {
    const item = this.getItem(id);
    return item ? item.value : 0;
  }

  updateItem(did, doc) {
    console.log('GL updateItem did=' + did + util.inspect(doc));
    let clone;
    if (this.glByDid[did]) {
      clone = hut.clone(this.glByDid[did]);
      this.removeItem(did);
    }
    // Добавить заново˝- значение нужно сохранить!!!??
    this.addItem(did, doc, clone ? { val: clone.value, ts: clone.ts, prev: clone.prev } : '');
  }

  removeItem(did) {
    if (this.glByDid[did]) {
      const dn = this.glByDid[did].dn;
      if (dn) delete this.glByDn[dn];
      delete this.glByDid[did];
    }
  }
}

module.exports = Globalmanager;
