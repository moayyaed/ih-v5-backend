/**
 * 
 */

const util = require('util');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
const typestore = require('./typestore');


class Devicemate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  start() {
    // Слушать события изменения таблиц, связанных с устройствами и типами
    this.dm.on('inserted:device', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
    });

    this.dm.on('updated:device', docs => {
      if (!docs || !docs.length) return;
      // Изменены устройства - изменить в devSet, возможно изменение dn!

      console.log('update:device ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.$set && doc.$set.dn) {
          // TODO В связи с изменением dn - ???
        }
      });
      // Приходят только изменения. Существенные? И предыдущая запись для сравнения?
      console.log('EMIT: devices has updated! ' + docs);
    });

    this.dm.on('removed:device', docs => {
      // Удалены устройства - удалить из devSet и возможно еще где-то
      if (!docs || !docs.length) return;

      console.log('removed:device ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.dn) {
          // TODO В связи с изменением dn - ???
        }
      });
      console.log('EMIT: devices has removed! ' + docs);
    });

    return this.load();
  }

  async load() {
    // Получить список устройств из таблицы devices, создать devSet и devMap
      // загрузка данных в typestore - типы и префиксы device
      const typeDocs = await this.dm.dbstore.get('types', {}, {});
      const deviceDocs = await this.dm.dbstore.get('devices', {}, { order: 'dn' });
      typestore.start(typeDocs, deviceDocs, this.dm);
      
      this.engine.typestore = typestore;
      return deviceDocs;

      /*
      this.devSet = {};
      this.createDevSet(deviceDocs);

    deviceDocs.forEach(item => {
      if (item.dn) {
        // console.log('devDoc ' +util.inspect(item));
        this.devSet[item.dn] = new Devo(item, typestore);
        // console.log(item.dn +util.inspect(devSet[item.dn]));
        devMap.set(item._id, item.dn);
      } else {
        console.log('devices._id = ' + item._id + '. NO dn! SKIPPED doc: ' + util.inspect(item));
      }
    });
    */
  }

}

module.exports = Devicemate;
