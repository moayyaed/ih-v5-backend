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
      this.onAcceptDeviceData(data)
    });

    // Данные, которые пишутся при изменении
    holder.on('changed:device:data', data => {
      this.onChangeDeviceData(data)
    });
  }

  start(docs) {
    console.log('INFO: Trend engine has started');
    docs.forEach(doc => this.setItem(doc));
  }

  onAcceptDeviceData(data) {
    const toWrite = [];
    data.forEach(item => {
      // item { did: 'd0024', dn: 'vvv150', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3}
      const trendId = getTrendId(item.did, item.prop);
      if (this.trendOnAccept[trendId]) {
        toWrite.push({ dn: item.dn, prop: item.prop, ts: item.ts, val: item.value });
      }
    });
    if (toWrite.length) dbconnector.write(toWrite);
  }

  onChangeDeviceData(data) {
    const toWrite = [];
    data.forEach(item => {
      // item { did: 'd0024', dn: 'vvv150', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3}
      const trendId = getTrendId(item.did, item.prop);
      if (this.trendOnChange[trendId]) {
        // TODO - для учета delta нужно сохранять последнее записанное значение
        toWrite.push({ dn: item.dn, prop: item.prop, ts: item.ts, val: item.value });
      }
    });
    if (toWrite.length) dbconnector.write(toWrite);
  }

  setItem(item) {
    const didprop = getTrendId(item.did, item.prop);
    switch (item.dbmet) {
      case 0:  // Не сохранять
        this.removeItem(didprop);
        return;

      case 1:
        this.trendOnChange[didprop] = item; // TODO - взять только нужные параметры!
        if (this.trendOnAccept[didprop]) this.trendOnAccept[didprop] = '';
        if (this.trendOnTimer[didprop])  this.trendOnTimer[didprop] = '';
        return;

      case 2:
        this.trendOnAccept[didprop] = item;
        if (this.trendOnChange[didprop])  this.trendOnChange[didprop] = '';
        if (this.trendOnTimer[didprop])  this.trendOnTimer[didprop] = '';
        return;

      case 3:
        this.trendOnTimer[didprop] = item;
        if (this.trendOnChange[didprop])  this.trendOnChange[didprop] = '';
        if (this.trendOnAccept[didprop]) this.trendOnAccept[didprop] = '';
        return;

      default:
        console.log('ERROR: trendserver: Unexpected dbmet '+item.method+util.inspect(item));
        
    }
  }

  removeItem(didprop) {
    if (this.trendOnChange[didprop]) this.trendOnChange[didprop] = '';
    if (this.trendOnAccept[didprop]) this.trendOnAccept[didprop] = '';
    if (this.trendOnTimer[didprop]) this.trendOnTimer[didprop] = '';
  }
}

function getTrendId(did, prop) {
  return did + '_' + prop;
}

module.exports = Trendengine;
