/**
 *  transfer_utils.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const appconfig = require('../lib/appconfig');

/**
 *
 * @param {*} main - data from main table  = getSourceData('chartlist', folder)
 * @param {*} slave - data from slave table  = getSourceData('charts', folder)
 * @param {*} linkname - 'chartid'
 * @param {*} parent - 'chartgroup'
 * @param {*} ruleId - {pref:'r', len:3}
 *
 */

function createFromMainAndSlave(main, slave, linkname, parent, ruleId) {
  let str = '';
  // Сформировать по chartid (repid)
  const slaveObj = {};
  let pn; // Порядковый номер в нижней табличке преобразуется в свойство px?

  slave.forEach(item => {
    pn = 1;
    const mainid = item[linkname];
    if (!slaveObj[mainid]) slaveObj[mainid] = {};
    delete item.id;
    slaveObj[mainid]['p' + pn] = item;
    pn++;
  });

  let order = 100;
  main.forEach(item => {
    item.order = order;
    order += 100;

    const _id = getNewId(ruleId.pref, ruleId.len, item.id);
    const slaveItem = slaveObj[item.id];
    delete item.id;
    str += formСombinedRecord(_id, item, slaveItem, parent);
  });
  return str;
}

function formСombinedRecord(_id, item, slaveItem, parent) {
  const pobj = Object.assign({ _id, parent }, item, { props: slaveItem });
  return JSON.stringify(pobj) + '\n';
}

function getRootItem(source) {
  let robj = {};
  switch (source) {
    case 'places':
      robj = { _id: 'place', list: 'place', parent: 0, order: 0, name: 'All ' + source };
      break;

    case 'spaces':
      robj = { _id: 'layoutgroup', list: 'layoutgroup', parent: 0, order: 0, name: 'All ' + source };
      break;
    default:
      robj = '';
  }
  return robj ? JSON.stringify(robj) + '\n' : '';
}

function formRecord(source, target, item, extObj) {
  let robj = {};
  let parent;
  let ext;
  let _id;
  switch (source) {
    // places - id будет dgxx или dgxxryy, хотя дальше будет dg000
    case 'places':
      robj = { _id: 'dg' + item.id, list: 'place', parent: 'place', order: item.order, name: item.name };
      break;

    case 'rooms':
      parent = 'dg' + item.place;
      robj = { _id: 'dg' + item.place + 'r' + item.id, list: 'place', parent, order: item.order, name: item.name };
      break;

    case 'spaces': // => lists- layoutgroup
      _id = getNewId('lg', 3, item.id);
      robj = { _id, list: 'layoutgroup', parent: 'layoutgroup', order: item.order, name: item.name };
      break;

    case 'layouts': //
      _id = getNewId('l', 3, item.id);
      parent = item.space ? getNewId('lg', 3, item.space) : 'layoutgroup';
      robj = { _id, parent, order: item.order, name: item.name, txt: item.txt };
      break;

    case 'mnemoschemes': //
      _id = getNewId('mn', 3, item.id);
      parent = 'viscontgroup';
      robj = { _id, parent, order: item.order, name: item.name, txt: item.txt };
      break;
/*
    case 'scenecall': //
      _id = getNewId('call', 3, item.id);
      const sid = item.scene;
      delete item.id;
      delete item.scene;
      delete item.order;
      robj = { _id, sid, ...item };
      break;
*/

    case 'classes': // => lists- typegroup, но id по старому - SensorD,....
      robj = { _id: item.id, list: 'typegroup', parent: 'typegroup', order: item.order, name: item.name };
      break;

    case 'units':
      _id = getNewId('u', 3, item.id);
      robj = { _id, parent: 'plugin_' + item.plugin };
      Object.keys(item).forEach(prop => {
        if (!prop.endsWith('_')) robj[prop] = item[prop];
      });
      break;

    default:
      robj = '';
      console.log('Not found source ' + source);
  }
  return robj ? JSON.stringify(robj) + '\n' : '';
}

function getSysDataFile(source) {
  // Считать, перевести??
  const cfilename = path.join('./sysbase_c', source + '.json');
  const data = JSON.parse(fs.readFileSync(cfilename, 'utf8'));
  appconfig.translateSys(data);
  return data;
}

function createTypes() {
  const classes = getSysDataFile('classes');
  const clObj = hut.arrayToObject(classes, 'id'); // Вывернуть

  const data = getSysDataFile('types');

  // сформировать строку
  let str = '';
  let order = 1000;
  let _id;
  data.forEach(item => {
    _id = getNewId('t', 3, item.id);
    const robj = { _id, parent: item.cl, order, name: item.name };
    robj.props = clObj[item.cl].props;
    str += JSON.stringify(robj) + '\n';
    order += 1000;
  });
  return str;
}

/**
 *  devref содержал флаги и значения (min, max, ..флаги записи в БД) в целом для устройства:
 *    {dn, min, max, decdig, mu, db, dbraw, dbline, dbdelta, dbcalc_type, dbforce, dbwrite_need_on }
 *   Сейчас нужно для каждого свойства отдельно, внутри свойства  props
 *   Добавляем для свойства value и опционально для setpoint (min, max, mu)

 *    {_id:'d001', dn:'TEMP1', props:{value:{min:20, max:50, dig:2, mu:'C'}, setpoint:{min:20, max:50, mu:'C'}}
 *   TODO Здесь же будут сохраняться свойства-параметры (не динамические?) {id, myparam1:45,myparam2:85, aux:{..}}
 *
 * @param {Array of Objects} devrefData - данные из devref
 * @param {String} project_d
 */

function createDevices(devrefData, project_d, extObj) {
  // Свойства формировать на основе классов (которые уже перенесены в типы)
  const classes = getSysDataFile('classes');
  const clObj = hut.arrayToObject(classes, 'id');

  let str = '';
  // Проверить, что parent есть, иначе в корень
  const filename = path.join(project_d, 'jbase', 'lists.db');
  const liststr = fs.readFileSync(filename, 'utf8');
  const arr = liststr.split('\n');

  // Вывернуть по  _id
  const placeObj = hut.arrayToObject(
    arr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    '_id'
  );

  let order = 1000;
  devrefData.forEach(item => {
    const parent = getParent(item);
    const dobj = formDeviceFromDevref(item, parent, order, extObj);
    // const tobj = typeObj[item.type];
    // if (!tobj) throw { message: 'Not found type for item ' + util.inspect(item) };

    dobj.props = formProps(item, Object.keys(clObj[item.cl].props));
    str += JSON.stringify(dobj) + '\n';
    order += 1000;
  });
  return str;

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
}

function formDeviceFromDevref(item, parent, order, extObj) {
  const ext = item.subs && extObj[item.subs] ? [extObj[item.subs]] : [];

  return {
    _id: getNewId('d', 4, item.id),
    parent,
    order,
    // type: 't' + item.type,
    type: getNewId('t', 3, item.type),
    dn: item.dn,
    name: item.name,
    tags: ext
  };
}

function formProps(item, propArr) {
  const pobj = {};
  propArr.forEach(prop => {
    pobj[prop] = formOneProp(item, prop);
  });
  /*
  // Переносим только для value и setpont - опционально
  // TODO Нужно еще как-то перенести состояния??  devstates => state с алгоритмом по умолчанию??

  pobj.value = { db: item.db ? 1 : 0, mu: item.mu || '' };
  if (isAnalog(item)) {
    pobj.value.min = item.min != undefined ? item.min : null;
    pobj.value.max = item.max != undefined ? item.max : null;
    pobj.value.dig = item.decdig || 0;

    pobj.setpoint = { mu: item.mu || '' };
    pobj.setpoint.min = item.min != undefined ? item.min : null;
    pobj.setpoint.max = item.max != undefined ? item.max : null;
  }
  */

  return pobj;
}
function formOneProp(item, prop) {
  let mmObj;
  if (isAnalog(item)) {
    mmObj = {};
    mmObj.min = item.min != undefined ? item.min : null;
    mmObj.max = item.max != undefined ? item.max : null;
    mmObj.dig = item.decdig || 0;
    mmObj.mu = item.mu || '';
  }

  switch (prop) {
    case 'value':
      return Object.assign({ db: item.db ? 1 : 0 }, mmObj);

    case 'setpoint':
      return Object.assign({ db: 0 }, mmObj, { dig: 0 });

    default:
      return { db: 0 };
  }
}

/**
 *  devcurrent содержал значения свойств в целом для устройства:
 *    {dn, aval, devref, auto, blk }
 *   Сейчас нужно для каждого свойства отдельно, внутри свойства  raw?
 *   id тот же что и в devices
 *    {id, raw:[{prop:value, val:20, ts:1578990909, src:'modbus'}, {prop:setpoint, val:22, ts, src:}]
 
 * @param {Array of Objects} devcurData - данные из devcurrent
 * @param {String} project_d
 */
function createDevcurrent(devcurData, project_d) {
  let str = '';

  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  /*
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const darr = dstr.split('\n');

  // Вывернуть по  dn
  const deviceObj = hut.arrayToObject(
    darr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    'dn'
  );
 */

  const deviceObj = genDeviceMap(project_d);
  devcurData.forEach(item => {
    // Найдем id устройства по dn
    console.log(item.id);
    const did = deviceObj[item.id] ? deviceObj[item.id]._id : '';

    if (!did) {
      console.log('NOT FOUND id for ' + item.id + ' in devices.db');
    } else {
      str += formCurRecord(did, item);
    }
  });

  return str;
}

function formCurRecord(did, item) {
  const pobj = { _id: did };
  const raw = [];

  let val;
  if (item.aval != undefined) {
    val = item.aval;
  } else if (item.dval != undefined) {
    val = item.dval;
  }
  if (val != undefined) raw.push({ prop: 'value', val, ts: item.lastts, src: '' });

  ['auto', 'defval', 'blk'].forEach(prop => {
    if (item[prop] != undefined) raw.push({ prop: getNewProp(prop), val: item[prop], ts: item.lastts, src: '' });
  });

  pobj.raw = raw;

  return JSON.stringify(pobj) + '\n';
}

function genDeviceMap(project_d) {
  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const darr = dstr.split('\n');

  // Вывернуть по  dn
  return hut.arrayToObject(
    darr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    'dn'
  );
}

function createScenecalls(scenecallData, project_d) {
  let str = '';

  const deviceObj = genDeviceMap(project_d);
  scenecallData.forEach(item => {
    const robj = { _id: getNewId('call', 3, item.id), sid: item.scene };

    delete item.id;
    delete item.scene;
    delete item.order;

    // Найдем did устройства по dn для КАЖДОГО параметра!!
    Object.keys(item).forEach(prop => {
      const dn = item[prop];
      const did = deviceObj[dn] ? deviceObj[dn]._id : '';

      if (!did) {
        console.log('NOT FOUND id for dn=' + dn + ' in devices.db');
      } else {
        robj[prop] = did;
      }
    });
    str += JSON.stringify(robj) + '\n';
  });

  return str;
}
/**
 *  devhard содержит связки dn - unit, chan, если complex=false
 * 
 *   Сейчас нужно для каждого свойства отдельно всегда (обычно prop:value)
 *   id - новый, подряд, did= devices._id
 *    {id, did, prop, unit, chan, <inv,...>, hard:{... actions:[{act:on,...},..]} 
 
 * @param {Array of Objects} devcurData - данные из devcurrent
 * @param {String} project_d
 */
function createDevhard(devhardData, project_d) {
  let str = '';
  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const deviceObj = getDeviceObj(devicesfile);

  // Упорядочить по chan и генерировать order подряд
  devhardData.sort(hut.byorder('chan'));
  let order = 1000;

  const complexMap = new Map();
  devhardData.forEach(item => {
    if (item.dn && item.unit) {
      if (item.complex) {
        // Нужно собрать по одному устройству - dval, on/off
        // {"id":"896","prop":"off","unit":"wip5","dn":"H306","complex":true,"value":"1","desc":"DO",""chan":"_off_H306_PL31","calc":"","nofb":false,"op":"W"},
        // {"id":"941","prop":"dval","unit":"wip5","dn":"H306","complex":true,"value":"","desc":"DI","chan":"_r_H306_PL31","calc":"","nofb":false,"op":"R"},
        // {"id":"943","prop":"on","unit":"wip5","dn":"H306","complex":true,"value":"1","desc":"DO","chan":"_on_H306_PL31","calc":"","nofb":false,"op":"W"},
        if (!complexMap.has(item.dn)) complexMap.set(item.dn, []);
        complexMap.get(item.dn).push(item);
      } else {
        // Найдем id устройства по dn
        console.log(item.dn);
        const did = deviceObj[item.dn] ? deviceObj[item.dn]._id : '';

        if (!did) {
          console.log('NOT FOUND id for ' + item.id + ' in ' + devicesfile);
        } else {
          item.order = order;
          str += formHardRecord(did, item);
          order += 1000;
        }
      }
    }
  });

  // TODO Сформировать из комплексных каналов ( wip)

  return str;
}
/** 
function formHardRecord(did, item) {
  if (item.complex) return '';

  if (!item.chan) item.chan = item.dn;
  const pobj = {
    _id: did,
    did,
    prop: 'value',
    unit: item.unit,
    chan: item.chan,
    inv: item.inv,
    calc: item.calc,
    desc: item.desc
  };

  const hard = getHardObjForUnit(item);
  // Может и не быть - например wip
  if (hard) {
    pobj.hard = hard;
    
    if (item.actions) {
      let actions;
      actions = hut.clone(item.actions, actions);
      pobj.hard.actions = actions;
    }
  }
  return JSON.stringify(pobj) + '\n';
}
*/

function formHardRecord(did, item) {
  if (item.complex) return '';

  if (!item.chan) item.chan = item.dn;
  const pobj = {
    _id: did,
    did,
    prop: 'value',
    unit: item.unit,
    chan: item.chan,
    inv: item.inv,
    calc: item.calc,
    desc: item.desc,
    order: item.order
  };

  const hard = getHardObjForUnit(item);
  // Может и не быть - например wip
  let robj;
  if (hard) {
    robj = Object.assign(pobj, hard);

    if (item.actions && Array.isArray(item.actions)) {
      const actions = {};
      // Перенос как вложенный объект:
      // actions:[{act:'on', type:'int' },..] => actions:{on:{type:'int'}}
      // actions = hut.clone(item.actions, actions);
      item.actions.forEach(el => {
        if (el.act) actions[el.act] = el;
      });
      robj.actions = actions;
    }
  } else robj = pobj;
  return JSON.stringify(robj) + '\n';
}

function getHardObjForUnit(item) {
  const plugin = hut.removeLastNumFromStr(item.unit);
  switch (plugin) {
    case 'mqttclient':
      return { topic: item.topic };
    // {"unit":"mqttclient1","topic":"/MT8102iE/Analog_Position_Carriage","actions":[{"act":"on","topic":"/devices/dn/command","message":"on"},{"act":"off","topic":"/devices/dn/command","message":"off"}]},
    case 'modbus':
      // {"unit":"modbus2", "vartype":"float","usek":false,"ks":100,"ks0":0, "gr":true,"pollp":true,"kh0":0,"address":"6","fcr":"3","useactions":false,"actions":[{"act":"on","address":"0x0000","vartype":"bool","value":""}],"kh":100,"nofb":false,"unitid":1},
      return {
        address: item.address,
        vartype: item.vartype,
        usek: item.usek,
        gr: item.gr,
        pollp: item.pollp,
        fcr: item.fcr,
        ks: item.ks,
        ks0: item.ks0,
        kh0: item.kh0,
        kh: item.kh,
        unitid: item.unitid,
        useactions: item.useactions
      };

    case 'ping':
      // {"unit":"ping1","lost":0,"interval":15,"ip":"192.168.103.61"}
      return { ip: item.ip, interval: item.interval, lost: item.lost };

    case 'snmp':
      // {"unit":"snmp1","get_oid":"1.3.6.1.2.1.33.1.3.3.1.3.1","interval":5,"parentid":"774","number":false, "parse":"String(value)","trap_oid":"","table_oid":"1.3.6.1.2.1.2.2","type":"get","actions":[{"act":"on","oid":"1.3.6.1.4.1.2.6.2.2.1.2.1","type":"Integer","value":"1"}]}
      return {
        get_oid: item.get_oid,
        interval: item.interval,
        parentid: item.parentid,
        number: item.number,
        parse: item.parse,
        trap_oid: item.trap_oid,
        table_oid: item.table_oid,
        type: item.type
      };

    case 'wip':
      // {"unit":"wip5", "complex":false,"chan":"_r_DD304_PL31","calc":"","nofb":false,"op":""},
      // а если complex - нужно собирать по всему файлу!!

      return '';

    default:
  }
}

function getDeviceObj(devicesfile) {
  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const darr = dstr.split('\n');

  // Вывернуть по  dn
  return hut.arrayToObject(
    darr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    'dn'
  );
}

function getNewId(pref, len, oldId) {
  return isNaN(oldId) ? oldId : pref + String(Number(oldId)).padStart(len, '0');
}

function getNewProp(prop) {
  return prop == 'defval' ? 'setpoint' : prop;
}

function isAnalog(item) {
  return item.cl == 'SensorA' || item.cl == 'ActorA';
}

module.exports = {
  createFromMainAndSlave,
  getRootItem,
  formRecord,
  getSysDataFile,
  createTypes,
  createDevices,
  createDevhard,
  createDevcurrent,
  createScenecalls
};
