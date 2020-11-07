/**
 * trendengine.js
 */
const util = require('util');

const dbconnector = require('../dbconnector');

class Trendengine {
  constructor(holder, dm) {
    this.holder = holder;
    this.dm = dm;

    this.trendSet = {}; // key= _id (did) - какие устройства сохраняются в БД - для формирования списков для графиков??
    this.trendOnChange = {}; // key = metric (d003.value)
    this.trendOnAccept = {};
    this.trendOnTimer = {};

    holder.trendSet = this.trendSet;

    // Данные, которые пишутся при получении данных независимо от изменения
    holder.on('accepted:device:data', data => {
      // console.log('TRENDEN: get:device:data ' + util.inspect(data));
    });

    // Данные, которые пишутся при изменении
    holder.on('changed:device:data', data => {
      
      console.log('WARN: changed:device:data ' + util.inspect(data));
      const toWrite = data.map(item => ({dn:item.dn, prop:item.prop, ts:item.ts, val:item.value}));
      dbconnector.write(toWrite);
    });
  }

  start(docs) {
    console.log('INFO: Trend engine has started');
    docs.forEach(doc => this.addDeviceTrendItem(doc));
  }

  addDeviceTrendItem(doc) {
    // doc {did, prop, dbmet, dbdelta}
    const didprop = doc.did + '.' + doc.prop;
    if (doc.dbmet > 0) {
      this.addItem(didprop, doc.dbmet, doc);
    } else {
      // Не сохранять - Убрать из всех
      this.removeItem(didprop);
    }
  }

  addItem(didprop, method, item) {
    switch (method) {
      case 1:
        this.trendOnChange[didprop] = item; // TODO - взять только нужные параметры!
        return true;

      case 2:
        this.trendOnAccept[didprop] = item;
        return true;

      case 3:
        this.trendOnTimer[didprop] = item;
        return true;
      default:
        return false;
    }
  }

  removeItem(didprop) {
    if (this.trendOnChange[didprop]) this.trendOnChange[didprop]='';
    if (this.trendOnAccept[didprop]) this.trendOnAccept[didprop]='';
    if (this.trendOnTimer[didprop]) this.trendOnTimer[didprop]='';
  }
}

module.exports = Trendengine;
