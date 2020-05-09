/**
 *
 */

const util = require('util');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
const typestore = require('./typestore');
const handlerutils = require('./handlerutils');

class Devicemate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  async start() {
    this.revising = true;
    await this.dm.reviseTableWithFolder('handler', handlerutils.syncHandlers);
    this.revising = false;

    // Слушать события изменения таблиц, связанных с устройствами и типами
    this.dm.on('inserted:device', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
      docs.forEach(doc => this.engine.addDevice(doc));

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

   // Добавление-удаление свойств в типе
   // Если есть устройства этого типа - нужно изменить все устройства (device)
    this.dm.on('changed:typeprops', async (type, updateObj) => {
      if (!type || !updateObj) return;
   
      console.log('ON changed:typeprops '+util.inspect(updateObj));
      // const docs = await this.dm.dbstore.get('devices', { type: doc._id }, { fields: { dn: 1, type: 1 } });

      const updatedDocs = await this.dm.dbstore.updateAndReturnUpdatedDocs('devices', {type}, updateObj)
      console.log('updatedDocs ='+util.inspect(updatedDocs));
      if (updatedDocs && updatedDocs.length) {
        // Внести изменения - добавить или удалить свойства для всех устройств по типу??
        // Изменить 

      }
    });

    // Изменение параметров свойств - min,max,... -  aux
    this.dm.on('updated:devicecommonTable', docs => {
      if (!docs || !docs.length) return;

      console.log('update:devicecommonTable ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc._id && doc.$set && this.engine.devSet[doc._id]) {
          const dobj = this.engine.devSet[doc._id];
          /** doc.$set:
            {
            'props.value.min': '2',
            'props.value.max': '32',
            'props.setpoint.min': '5',
            'props.setpoint.max': '25'
            }
          */
          Object.keys(doc.$set).forEach(fieldname => {
            const arr = fieldname.split('.');
            if (arr.length == 3 && arr[0] == 'props') {
              const prop = arr[1];
              if (dobj.hasProp(prop)) dobj.updateAux(prop, arr[2], doc.$set[fieldname]);
            }
          });
        }
      });
    });

    return this.load();
  }

  async load() {
    // Получить список устройств из таблицы devices
    // загрузка данных в typestore - типы и префиксы device
    const typeDocs = await this.dm.dbstore.get('types', {}, {});
    const deviceDocs = await this.dm.dbstore.get('devices', {}, { order: 'dn' });

    // Загрузить функции-обработчики:
    // 1. Считать папку handlers - там файлы со скриптами - обработчиками
    // 2. Синхронизировать таблицу handlers и папку. Droplist-ы достаются из handlers через liststore
    // 3. Список скриптов передать, чтобы сделать req соотв обработчикам либо использовать дефолтные

    typestore.start(typeDocs, deviceDocs, this.dm);

    this.engine.typestore = typestore;
    return deviceDocs;
  }
}

module.exports = Devicemate;
