/**
 * trendengine.js
 */
const util = require('util');

class Trendengine {
  constructor(holder) {
    this.holder = holder;

    this.trendSet = {}; // key= _id (did) - какие устройства сохраняются в БД - для формирования списков для графиков??
    this.trendOnChange = {}; // key = metric (d003.value)
    this.trendOnGet = {};
    this.trendOnTimer = {};

    holder.trendSet = this.trendSet;

    // Данные, которые пишутся при поступлении
    holder.on('get:device:data', data => {
      // console.log('TRENDEN: get:device:data ' + util.inspect(data));
    });

    // Данные, которые пишутся при изменении
    holder.on('changed:device:data', data => {
      // console.log('TRENDEN: changed:device:data ' + util.inspect(data));
    });
  }

  start(docs) {
    docs.forEach(doc => this.addDeviceTrendItems(doc));
  }

  addDeviceTrendItems(doc) {
    const props = doc.props;
    let active = false;
    if (props) {
      Object.keys(props).forEach(prop => {
       
        active = active || this.addPropItem( doc._id, prop, props[prop]);
      });
      if (active) {
      this.trendSet[doc._id] = doc.props;
      }
    }
  }

  addPropItem(id, prop, propItem) {
    const method = Number(propItem.dbmet);
    const metric = String(id+'.'+prop);

    switch (method) {
      case 1: 
        this.trendOnChange[metric] = {};
        return true;

      case 2:
        this.trendOnGet[metric] = {};
        return true;

      case 3:
        this.trendOnTimer[metric] = {};
        return true;
      default:
        return false;
    }
  }
}

module.exports = Trendengine;
