/**
 *
 */

const util = require('util');

// const appconfig = require('../appconfig');
// const hut = require('../utils/hut');
const typestore = require('./typestore');
const handlerutils = require('./handlerutils');

const linkmethods = require('../api/linkmethods');

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

    // setUnsetProps - Добавление-удаление свойств в типе
    //     Если есть устройства этого типа - нужно изменить все устройства: коллекцию devices, devSet
    // updateProps - изменения связаны с типом переменной - vtype, op - стало calc или замена функции
    //  это хранится в типе, но значение нужно пересчитать заново??? на базе raw значения
    this.dm.on('changed:typeprops', async (type, setUnsetProps, updateProps) => {
      if (!type) return;

      if (setUnsetProps) {
        const addedProps = setUnsetProps.$set ? getPropNamesArrayFromSetObj(setUnsetProps.$set) : [];
        const deletedProps = setUnsetProps.$unset ? getPropNamesArrayFromSetObj(setUnsetProps.$unset) : [];
        const renamedProps = {...setUnsetProps.$renamed};

        delete setUnsetProps.$renamed;

        // Добавление-удаление свойств - для всех устройств этого типа
        const updatedDocs = await this.dm.dbstore.updateAndReturnUpdatedDocs('devices', { type }, setUnsetProps);
 

        if (updatedDocs && updatedDocs.length) {
         
          for (const devDoc of updatedDocs) {
            await this.updateLinksForProps(devDoc, deletedProps, renamedProps);
       
            // Добавить/удалить свойства в devSet
            this.engine.changeDeviceProps(devDoc._id, addedProps, deletedProps);
          }

        }
      }

      // Изменились поля, которые требуют пересчета значений измененных свойств + поля calc
      // или замена функции - хранится в типе, но значение нужно пересчитать заново???
      if (updateProps) {
      }
    });

    // Изменение параметров свойств - min,max,... -  aux
    this.dm.on('updated:devicecommonTable', docs => {
      if (!docs || !docs.length) return;

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

  async updateLinksForProps(devDoc, deletedProps, renamedProps) {
    if (!deletedProps || !deletedProps.length) return [];

    // При удалении свойств - удалить привязку к каналу: Сбросить поля did, prop в devhard
    // При переименовании свойств - переименовать prop в devhard для did, prop

    for (const deletedProp of deletedProps) {
      const newprop = renamedProps && renamedProps[deletedProp] ? renamedProps[deletedProp] : '';
      const devhardDocs = await this.prepareUpdateDeviceLink(devDoc._id, deletedProp, newprop);
      if (devhardDocs) {
        await this.dm.updateDocs('devhard', devhardDocs);
      }
    }
  }

  async prepareUpdateDeviceLink(did, prop, newprop) {
    const docs = await this.dm.dbstore.get('devhard', { did, prop });

    // Если нашли - сформировать запись для изменения записи - в принципе, д б одна запись для одного свойства!!
    if (docs) {
      docs.forEach(doc => {
        doc.$set = newprop ? { prop: newprop } : { did: '', prop: '' };
      });
    }
    return docs;
  }
}

// ** Частные функции
function getPropNamesArrayFromSetObj(setObj) {
  const propset = new Set();
  if (setObj) {
    Object.keys(setObj).forEach(field => {
      if (field.startsWith('props.')) {
        propset.add(field.substr(6).split('.')[0]);
      }
    });
  }
  return [...propset];
}

module.exports = Devicemate;
