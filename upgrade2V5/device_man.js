/**
 *  device_man.js
 *  Объект для работы с устройствами
 *
 *  devref.json содержал флаги и значения (min, max, ..флаги записи в БД) в целом для устройства:
 *    {dn, min, max, decdig, mu, db, dbraw, dbline, dbdelta, dbcalc_type, dbforce, dbwrite_need_on }
 *   Сейчас нужно для каждого свойства отдельно, внутри свойства  props
 *
 *   Добавляем для свойства value и опционально для setpoint (min, max, mu)
 *    {_id:'d001', dn:'TEMP1', props:{value:{min:20, max:50, dig:2, mu:'C'}, setpoint:{min:20, max:50, mu:'C'}}
 *    Свойства формировать на основе классов
 *
 */

const util = require('util');

const hut = require('../lib/utils/hut');
const tut = require('./transfer_utils');

const oldDevMap = {};
const placeObj = {};

module.exports = {
  load(project_c) {
    const classes = tut.getSysDataFile('classes');
    const clObj = hut.arrayToObject(classes, 'id');
    console.log('clObj=' + util.inspect(clObj));

    const subsObj = tut.getSourceAsObj('subsystems', 'jbase', project_c);

    // Заполнить placeObj новыми id
    tut.getSourceData('places', 'jbase', project_c).forEach(item => {
      if (item.id) placeObj[tut.getPlaceId(item)] = item.name;
    });
    tut.getSourceData('rooms', 'jbase', project_c).forEach(item => {
      if (item.id) placeObj[tut.getRoomId(item)] = item.name;
    });

    const devrefData = tut.getSourceData('devref', 'jbase', project_c);
    // Формировать новый id, parent(place&room), tags(subs), type - TODO!! возможно с учетом привязанного железа!!
    devrefData.forEach(item => {
      const parent = getParent(item);
      const _id = tut.getNewId('d', 4, item.id);
      const type = 't' + item.cl; // tSensorA - новый тип - для создания устройства по типу
      const oldtype = item.type;
      const tags = item.subs && subsObj[item.subs] ? [subsObj[item.subs]] : [];

      const dobj = { _id, parent, type, dn: item.dn, name: item.name, tags, oldtype };
      dobj.props = formProps(item, Object.keys(clObj[item.cl].props));
      oldDevMap[item.dn] = dobj;
    });
  },

  getDevicesMap() {
    return oldDevMap;
  },

  getDevice(dn) {
    return oldDevMap[dn];
  },

  getDevicesArray() {
    return Object.keys(oldDevMap).map(dn => oldDevMap[dn]);
  },

  formAllDevicesStr() {
    let str = '';
    let order = 0;
    this.getDevicesArray().forEach(item => {
      order += 100;
      item.order = order;
      str += JSON.stringify(item) + '\n';
    });
    return str;
  }
};

function getParent(item) {
  let res = 'place';
  let x;
  if (item.place) {
    x = 'dg' + item.place;
    if (placeObj[x]) {
      res = x;
      if (item.room) {
        x += 'r' + item.room;
        if (placeObj[x]) res = x;
      }
    }
  }
  return res;
}

function formProps(item, propArr) {
  const pobj = {};
  propArr.forEach(prop => {
    pobj[prop] = formOneProp(item, prop);
  });

  return pobj;
}
function formOneProp(item) {
  let mmObj = {};
  if (isAnalog(item)) {
    mmObj.min = item.min != undefined ? item.min : null;
    mmObj.max = item.max != undefined ? item.max : null;
    mmObj.dig = item.decdig || 0;
    mmObj.mu = item.mu || '';
  }
  return mmObj;
}

function getNewProp(prop) {
  return prop == 'defval' ? 'setpoint' : prop;
}

function isAnalog(item) {
  return item.cl == 'SensorA' || item.cl == 'ActorA';
}
