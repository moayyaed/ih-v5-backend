/**
 *  devicemate.js
 */

const util = require('util');

const hut = require('../utils/hut');

class Devicemate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
   
    // Слушать события изменения таблиц, связанных с устройствами и типами
    this.dm.on('inserted:device', docs => {
      // Добавлены новые устройства - добавить в devSet, приходит вся запись целиком
      console.log('EMIT: devices has inserted! ' + docs);
      docs.forEach(doc => this.engine.addDevice(doc));
    });

    this.dm.on('updated:device', async docs => {
      if (!docs || !docs.length) return;

      // Изменение типа отрабатывается в beforeUpdate - уже записаны новые свойства
      // Если свойства были привязаны к каналам - нужно их отвязать
      // console.log('updated:device ' + util.inspect(docs));
      for (const doc of docs) {
        if (doc.$set) {
          // Если изменен dn - изменить ссылку this.dnSet, изменить в devSet
          if (doc.$set.dn) this.engine.changeDeviceDn(doc._id, doc.dn, doc.$set.dn);

          if (doc.$set.type) {
            // старый и новый тип - сравнить свойства и команды
            const newTypeProps = this.engine.typestore.getPropAndCommandNameArray(doc.$set.type);
            const oldTypeProps = this.engine.typestore.getPropAndCommandNameArray(doc.type);

            // Изменились свойства -> проверить привязку к каналам, очистить несуществующие привязки
            const deleteProps = hut.arrayDiff(oldTypeProps, newTypeProps);
            if (deleteProps.length) await this.updateLinksForProps(doc, deleteProps);

            // изменить в devSet
            const addProps = hut.arrayDiff(newTypeProps, oldTypeProps);
            this.engine.changeDeviceType(doc._id, doc.$set.type, addProps, deleteProps);
          }

          // Если изменены свойства, которые берутся в devo (без dn и type) - изменить в devSet
          // Вызываемая функция сама выберет по списку из devo
          this.engine.changeDeviceFields(doc._id, doc.$set);
        }
      }
    });

    this.dm.on('removed:device', async docs => {
      // Удалены устройства - удалить из devSet и возможно еще где-то
      if (!docs || !docs.length) return;

      console.log('removed:device ' + util.inspect(docs));
      for (const doc of docs) {
        // Нужно удалить привязки к каналам для этого устройства
        await this.clearLinksForDevice(doc._id);
        this.engine.removeDevice(doc);
      }
    });

    // setUnsetProps - Добавление-удаление свойств в типе
    //     Если есть устройства этого типа - нужно изменить все устройства: коллекцию devices, devSet
    // updateProps - изменения связаны с типом переменной - vtype, op - стало calc или замена функции
    //  это хранится в типе, но значение нужно пересчитать заново??? на базе raw значения
    this.dm.on('changed:typeprops', async (type, setUnsetProps) => {
      if (!type) return;

      if (setUnsetProps) {
        const addedProps = setUnsetProps.$set ? getPropNamesArrayFromSetObj(setUnsetProps.$set) : [];
        const deletedProps = setUnsetProps.$unset ? getPropNamesArrayFromSetObj(setUnsetProps.$unset) : [];
        const renamedProps = { ...setUnsetProps.$renamed };

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
    });

    // Изменение параметров свойств - min,max,... -  aux
    this.dm.on('updated:devicecommonTable', docs => {
      if (!docs || !docs.length) return;

      docs.forEach(doc => {
        /*
          // doc.$set:{
          //  'props.value.min': '2',
          //  'props.value.max': '32',
          //  'props.setpoint.min': '5',
          //  'props.setpoint.max': '25'}
        */
        if (doc.$set && doc._id) {
          // Если изменены табличные свойства - min, max, dig - заменить в _aux
          const auxArr = [];
          Object.keys(doc.$set).forEach(field => {
            if (field.startsWith('props.')) {
              const [prop, auxprop] = field.substr(6).split('.');
              auxArr.push({ prop, auxprop, val: doc.$set[field] });
            }
          });
          console.log('changeDeviceAux ' + util.inspect(auxArr));

          if (auxArr.length) this.engine.changeDeviceAux(doc._id, auxArr);
        }
        // пересчитать текущие значения свойства - внутри devo??
      });
    });

    /*
    // Изменение призяки к каналам для устройств, интересуют только свойства для записи
    this.dm.on('updated:devhard', docs => {
      console.log('EMIT: devhard has updated! ' + docs);

      docs.forEach(doc => {
        if (doc.$set) {
          // Могли поменять привязку (did,prop) или флаг записи

          // Удалить, если была привязка в старом документе и она изменилась.
          // Или канал перестал быть для записи
          if (doc.did != doc.$set.did || doc.prop != doc.$set.prop || !nowForWrite(doc)) {
            this.engine.updateWriteChan(doc.did, doc.prop, '');
          }
          // Записать, если есть привязка и канал для записи
          if ((doc.$set.did || doc.$set.prop) && nowForWrite(doc)) {
            this.engine.updateWriteChan(doc.$set.did || doc.did, doc.$set.prop || doc.prop, doc.$set.unit || doc.unit);
          }
        }
      });

      function nowForWrite(doc) {
        return doc.$set.w || (doc.$set.w == undefined && doc.w);
      }
    });

    this.dm.on('inserted:devhard', docs => {
      // Добавлены новые каналы - могли добавить виесте с привязкой
      console.log('EMIT: devhard has inserted! ' + docs);
      docs.forEach(doc => {
        if (doc.did && doc.prop && doc.unit && doc.w) {
          // Канал для записи
          this.engine.updateWriteChan(doc.did, doc.prop, doc.unit);
        }
      });
    });

    this.dm.on('removed:devhard', async docs => {
      // Удалены каналы - возможно, были привязки к устройствам
      console.log('removed:devhard ' + util.inspect(docs));
      docs.forEach(doc => {
        if (doc.did && doc.prop) {
          this.engine.updateWriteChan(doc.did, doc.prop, '');
        }
      });
    });
    */
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

  // Удалить все привязки каналов к устройству: Сбросить поля did, prop в devhard
  async clearLinksForDevice(did) {
    const docs = await this.dm.dbstore.get('devhard', { did });
    if (docs) {
      docs.forEach(doc => {
        doc.$set = { did: '', prop: '' };
      });
      await this.dm.updateDocs('devhard', docs);
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
