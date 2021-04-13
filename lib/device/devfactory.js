/**
 * 
 */

const deviceutil = require('./deviceutil');
const typestore = require('./typestore');

/**  create
 * Создать анемичный объект устройства
 *
 * Нужен именно анемичный объект (без методов), так как передается в worker
 *  {
 *    _id, dn, name, parent, type, tags, <value, state, battery, auto, ...>, error}
 *          - объект содержит статические и динамические значения свойств
 *
 *    Cвойства формируются согласно типу
 *    Для каждого свойства сохраняются атрибуты последнего присваивания:
 *   _raw: {value:{raw, val, ts, cts, src, err},
 *          auto:{raw, val, ts, cts, src, err}}
 *
 *           raw - полученное значение до обработки (применения функции)
 *           val - значение после обработки, оно присваивается объекту на первом уровне
 *           prev - предыдущее значение val
 *           ts - время получения значения
 *           cts - время изменения значения
 *           src - источник
 *           error - ошибка
 *
 *   Для каждого свойства  - дополнительные атрибуты
 *   _aux: Map(key=prop, {min, max, dig,def })
 *
 *   Для каждого свойства  - если есть привязка к каналу -
 *   _readSet: {value: { _id, unit, chan }}
 *   _readSet: {value: { _id, unit, chan }}
 *    }
 *
 * @param {Object} devDoc - документ из devices
 * @param {Object} dataObj - последние сохраненные значения
 * @param {Object} chanObj - привызки к каналам
 *
 * @return {Object} - объект устройства
 */

function create(devDoc, dataObj, chanObj) {
  const devObj = { _id: devDoc._id, dn: devDoc.dn, type: devDoc.type, _raw: {}, _aux: new Map() };

  // Плоские статичные поля
  deviceutil.changeFlatFields(devObj, devDoc);

  // Свойства на основе типа, но доп атрибуты могли изменить в устройстве
  const propsFromDevdoc = devDoc.props || {};
  const typeobj = typestore.getTypeObj(devObj.type);

  typeobj.proparr.forEach(propItem => {
    deviceutil.addProp(devObj, propItem.prop, propItem, propsFromDevdoc[propItem.prop]);
  });

  // команды
  typeobj.commands.forEach(command => {
    devObj._raw[command] = { cmd: 1 };
  });

  devObj.extProps = {};
  devObj.error = 0;
  devObj._raw.error = { val: 0 };

  if (dataObj) {
    if (typeof dataObj == 'object') {
      Object.keys(dataObj).forEach(prop => {
        devObj._raw[prop] = dataObj[prop]; // { raw: val, val, ts, src };
        devObj[prop] = dataObj[prop].val;
      });
    }
  }

  // Привязка к каналам
  if (chanObj) {
    Object.keys(chanObj).forEach(prop => {
      if (chanObj[prop].unit && chanObj[prop].chan) {
        deviceutil.setChannel(devObj, prop, chanObj[prop]);
      }
    });
  }
  return devObj;
}

module.exports = {
  create
}
