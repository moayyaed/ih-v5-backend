/**
 *  devicemate.js
 */

const util = require('util');

const hut = require('../utils/hut');
const deviceutil = require('./deviceutil');

class Devicemate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;
  }

  async start() {
    // Слушать запросы от других служб

    //  Создать системный индикатор
    // Возможно, он уже создан - тогда не создавать
    this.engine.holder.on('create:unitIndicator', unitId => {
      const id = deviceutil.getUnitIndicatorId(unitId);
      if (!this.engine.hasDevice(id)) {
        this.engine.addDevice(deviceutil.createUnitIndicatorDoc(unitId));
        this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
      }
    });

    // Удалить системный индикатор
    this.engine.holder.on('remove:unitIndicator', unitId => {
      const id = deviceutil.getUnitIndicatorId(unitId);
      if (this.engine.hasDevice(id)) {
        this.engine.removeDevice({ _id: id });
        deviceutil.removeUnitIndicatorDoc(unitId);
        this.dm.invalidateCache({ type: 'tree', id: 'sysdevices' });
      }
    });

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
            if (deleteProps.length) await this.updateLinksForDeletedProps(doc, deleteProps);

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
        try {
          // Удалить из devicedb
          const dbdocs = await this.dm.dbstore.get('devicedb', { did: doc._id });
          if (dbdocs.length) {
            await this.dm.removeDocs('devicedb', dbdocs);
          }

          // Удалить привязки к каналам для этого устройства
          await this.clearLinksForDevice(doc._id);
        } catch (e) {
          console.log('ERROR: After device ' + doc._id + 'remove: ' + util.inspect(e));
        }
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
            await this.updateLinksForDeletedProps(devDoc, deletedProps, renamedProps);

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
          //  'props.setpoint.max': '25'
          //  'props.setpoint.log': 1/0
        }
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

    // Изменение привязки к каналам для устройств
    this.dm.on('updated:devhard', docs => {
      console.log('MATE updated:devhard '+util.inspect(docs))

      docs.forEach(doc => {
        if (doc.$set) {
         
          // if (doc.did != doc.$set.did || doc.prop != doc.$set.prop) {
          if ( doc.$set.did || doc.$set.prop) {
           
            // Старую сбросить
            if (doc.did && doc.prop) {
              this.engine.clearChannelLink(doc.did, doc.prop);
              // this.engine.resetValueWithDefault(doc.did, doc.prop);
            }

            // Новую добавить
            if (doc.$set.did || doc.$set.prop) {
               const upDoc = Object.assign({}, doc, doc.$set);
               delete upDoc.$set;
               this.engine.setChannelLink(upDoc.did, upDoc.prop, upDoc);
            }
          }
        }
      });
    });

    this.dm.on('removed:devhard', async docs => {
      // Удалены каналы - возможно, были привязки к устройствам
      docs.forEach(doc => {
        if (doc.did && doc.prop) {
          this.engine.clearChannelLink(doc.did, doc.prop);
        }
      });
    });
  }

  /**
   * При удалении свойства устройства - удалить привязку к каналу: 
   *   Сбросить поля did, prop в devhard
   *   Если удаление - это переименовании свойства - переименовать prop в devhard для did, prop
   * 
   * @param {*} devDoc 
   * @param {*} deletedProps 
   * @param {*} renamedProps 
   */
  async updateLinksForDeletedProps(devDoc, deletedProps, renamedProps) {
    if (!deletedProps || !deletedProps.length) return [];

    for (const deletedProp of deletedProps) {
      const newprop = renamedProps && renamedProps[deletedProp] ? renamedProps[deletedProp] : '';
      const devhardDocs = await this.prepareUpdateDeviceLink(devDoc._id, deletedProp, newprop);
      if (devhardDocs) {
        await this.dm.updateDocs('devhard', devhardDocs);
      }
    }
  }

  /**
   * Удалить все привязки каналов к устройству: Сбросить поля did, prop в devhard
   * Выполняется при удалении устройства
   * @param {String} did 
   */
  async clearLinksForDevice(did) {
    const docs = await this.dm.dbstore.get('devhard', { did });
    if (docs) {
      docs.forEach(doc => {
        doc.$set = { did: '', prop: '' };
      });
      await this.dm.updateDocs('devhard', docs);
    }
  }

  /**
   * 
   * @param {String} did 
   * @param {String} prop 
   * @param {String} newprop 
   */
  async prepareUpdateDeviceLink(did, prop, newprop) {
    const docs = await this.dm.dbstore.get('devhard', { did, prop });
    if (!docs) return;

    // Если нашли - сформировать запись для изменения записи - в принципе, д б одна запись для одного свойства!!
   
      docs.forEach(doc => {
        doc.$set = newprop ? { prop: newprop } : { did: '', prop: '' };
      });
    
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
