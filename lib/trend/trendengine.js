/**
 * trendengine.js
 */
const util = require('util');

class Trendengine {
  constructor(holder) {
    this.holder = holder;

    this.trendSet = new Map();
    holder.trendSet = this.trendSet;

    // Данные, которые пишутся при поступлении
    holder.on('get:device:data', data => {
      console.log('TRENDEN: get:device:data ' + util.inspect(data));
    });

    // Данные, которые пишутся при изменении
    holder.on('changed:device:data', data => {
      console.log('TRENDEN: changed:device:data ' + util.inspect(data));
    });
  }

  start(docs) {
    this.trendSet.clear();
    docs.forEach(doc => {
      this.trendSet[doc._id] = doc; // ЭТО ПРОСТО ЗАГЛУШКА!!
    });
  }

}

module.exports = Trendengine;
