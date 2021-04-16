/**
 * device_struct.js
 */

const hut = require('../utils/hut');
const deviceutil = require('./deviceutil');

/**  create
 * Создать анемичный объект (структуру) устройства
 *
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
 *   _aux: {value:  {min, max, dig,def }}
 *
 *   Для каждого свойства  - если есть привязка к каналу -
 *   _readSet: {value: { _id, unit, chan }}
 *   _writeSet: {value: { _id, unit, chan }}
 *    }
 *
 * @param {Object} devDoc - документ из devices
 * @param {Object} typeMap
 * @param {Object} dataObj - последние сохраненные значения
 * @param {Object} chanObj - привызки к каналам
 *
 * @return {Object} - объект устройства
 */

function create(devDoc, typeMap, dataObj, chanObj) {
  const devObj = { _id: devDoc._id, dn: devDoc.dn, _raw: {}, _aux: {} };

  // Плоские статичные поля
  deviceutil.changeFlatFields(devObj, devDoc);

  // Свойства на основе типа
  devObj.type = devDoc.type && typeMap.has(devDoc.type) ? devDoc.type : deviceutil.getDefaultTypeId();
  const typeobj = typeMap.get(devDoc.type);

  const propsFromDevdoc = devDoc.props || {}; // На уровне устройства м б изменены поля (min, max,..)
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

/**
 * Извлечь структуру из объекта
 * @param {Object} devObj 
 */
function extract(devObj) {
  const res =  { _id: devObj._id};

  res._raw = hut.clone(devObj._raw);
  res._aux = hut.clone(devObj._aux);
  res.extProps = hut.clone(devObj.extProps);

  const flat = deviceutil.getFlatFields();
  flat.push('dn','type','error');
  flat.forEach(prop => {
    res[prop] = devObj[prop];
  });

  Object.keys(res._raw).forEach(prop => {
    const item = res._raw[prop];
    if (!item.cmd) {
      res[prop] = item.val;
    }
  });
  

  if (devObj._readSet) res._readSet = hut.clone(devObj._readSet);
  if (devObj._writeSet) res._writeSet = hut.clone(devObj._writeSet);

  return res;
}

module.exports = {
  create,
  extract
}
