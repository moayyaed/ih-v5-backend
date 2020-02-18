/**
 *
 */
const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const appconfig = require('../lib/appconfig');

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

function formRecord(source, target, item) {
  let robj = {};
  let parent;
  switch (source) {
    case 'places':
      robj = { _id: 'p' + item.id, list: 'place', parent: 'place', order: item.order, name: item.name };
      break;

    case 'rooms':
      parent = 'p' + item.place;
      robj = { _id: 'p' + item.place + 'r' + item.id, list: 'place', parent, order: item.order, name: item.name };
      break;

    case 'devref':
     
      parent = item.place ? 'p' + item.place + (item.room ? 'r' + item.room : '') : 'place';
      robj = {
        _id: 'd' + item.id,
        parent,
        order: item.order,
        type: 't' + item.type,
        dn: item.dn,
        name: item.dn + ' ' + item.name
      };
      break;

    case 'spaces': // => lists- layoutgroup
      robj = { _id: 's' + item.id, list: 'layoutgroup', parent: 'layoutgroup', order: item.order, name: item.name };
      break;

    case 'layouts': //
      parent = item.space ? 's' + item.space : 'layoutgroup';
      robj = { _id: 'l' + item.id, parent, order: item.order, name: item.name, txt: item.txt };
      break;

    case 'classes': // => lists- typegroup
      robj = { _id: item.id, list: 'typegroup', parent: 'typegroup', order: item.order, name: item.name };
      break;

    /* case 'types':
      robj = { _id: 't' + item.id, parent: item.cl, order: item.order, name: item.name };
      // Добавить props
      break;
     */

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
  let order = 100;
  data.forEach(item => {
    const robj = { _id: 't' + item.id, parent: item.cl, order, name: item.name };
    robj.props = clObj[item.cl].props;
    str += JSON.stringify(robj) + '\n';
    order += 100;
    /*
    clProps.forEach((pItem, idx) => {
      const pobj = Object.assign({ _id: 't' + typeitem.id + '_' + idx, type: 't' + typeitem.id }, pItem);
      str += JSON.stringify(pobj) + '\n';
    });
    */

  });
  return str;
}

/**
 *  devref содержал флаги и значения (min, max, ..флаги записи в БД) в целом для устройства:
 *    {dn, min, max, decdig, mu, db, dbraw, dbline, dbdelta, dbcalc_type, dbforce, dbwrite_need_on }
 *   Сейчас нужно для каждого свойства отдельно, внутри свойства  aux
 *   Добавляем для свойства value и опционально для setpoint (min, max, mu)
 *   id тот же что и в devices
 *    {id, aux:{value:{min:20, max:50, dig:2, mu:'C'}, setpoint:{min:20, max:50, mu:'C'}}
 *   Здесь же будут сохраняться свойства-параметры (не динамические?) {id, myparam1:45,myparam2:85, aux:{..}}
 *
 * @param {Array of Objects} devrefData - данные из devref
 * @param {String} project_d
 */
function createDevprops(devrefData, project_d) {
  let str = '';

  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const darr = dstr.split('\n');

  // Вывернуть по  dn
  const deviceObj = hut.arrayToObject(
    darr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    'dn'
  );

  devrefData.forEach(item => {
    // Найдем id устройства по dn
    const did = deviceObj[item.dn]._id;
    if (!did) {
      console.log('NOT FOUND id for ' + item.dn + ' in ' + devicesfile);
    } else {
      str += formPropRecord(did, item);
    }
  });

  return str;
}

function formPropRecord(did, item) {
  const pobj = { _id: did };
  const aux = [];
  const vObj = { prop: 'value', mu: item.mu || '', db: item.db ? 1 : 0 };

  if (isAnalog(item)) {
    vObj.min = item.min != undefined ? item.min : null;
    vObj.max = item.max != undefined ? item.max : null;
    vObj.dig = item.decdig || 0;
  }
  aux.push(vObj);

  if (isAnalog(item)) {
    const sObj = { prop: 'setpoint', mu: item.mu || '' };
    sObj.min = item.min != undefined ? item.min : null;
    sObj.max = item.max != undefined ? item.max : null;
    aux.push(sObj);
  }

  pobj.aux = aux;

  return JSON.stringify(pobj) + '\n';
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
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const darr = dstr.split('\n');

  // Вывернуть по  dn
  const deviceObj = hut.arrayToObject(
    darr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    'dn'
  );

  devcurData.forEach(item => {
    // Найдем id устройства по dn
    console.log(item.id);
    const did = deviceObj[item.id] ? deviceObj[item.id]._id : '';

    if (!did) {
      console.log('NOT FOUND id for ' + item.id + ' in ' + devicesfile);
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

/**
 *  devhard содержит связки dn - unit, chan, если complex=false
 * 
 *   Сейчас нужно для каждого свойства отдельно всегда (обычно prop:value)
 *   id - новый, подряд, did тот же что и в devices
 *    {id, did, prop, unit, chan, <inv,...>, hard:{... actions:[{act:on,...},..]} 
 
 * @param {Array of Objects} devcurData - данные из devcurrent
 * @param {String} project_d
 */
function createDevhard(devhardData, project_d) {
  let str = '';
  // Нужен, чтобы найти id  устройства - т к dn сейчас уже не id!!
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const deviceObj = getDeviceObj(devicesfile);

  const complexMap = new Map();
  devhardData.forEach(item => {
    if (item.dn && item.unit) {
      
      if (item.complex) {
        // Нужно собрать по одному устройству - dval, on/off
        // {"id":"896","prop":"off","unit":"wip5","dn":"H306","complex":true,"value":"1","desc":"DO",""chan":"_off_H306_PL31","calc":"","nofb":false,"op":"W"},
        // {"id":"941","prop":"dval","unit":"wip5","dn":"H306","complex":true,"value":"","desc":"DI","chan":"_r_H306_PL31","calc":"","nofb":false,"op":"R"},
        // {"id":"943","prop":"on","unit":"wip5","dn":"H306","complex":true,"value":"1","desc":"DO","chan":"_on_H306_PL31","calc":"","nofb":false,"op":"W"},
        if (!complexMap.has(item.dn))  complexMap.set(item.dn, []);
        complexMap.get(item.dn).push(item);
      } else {
        // Найдем id устройства по dn
        console.log(item.dn);
        const did = deviceObj[item.dn] ? deviceObj[item.dn]._id : '';

        if (!did) {
          console.log('NOT FOUND id for ' + item.id + ' in ' + devicesfile);
        } else {
          str += formHardRecord(did, item);
        }
      }
    }
  });

  // Сформировать из комплексных каналов ( wip)
  
  return str;
}

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
    // if ((item.desc == 'DO' || item.desc == 'AO') && item.actions) {
    if (item.actions) {
      let actions;
      actions = hut.clone(item.actions, actions);
      pobj.hard.actions = actions;
    }
  }
  return JSON.stringify(pobj) + '\n';
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

function getNewProp(prop) {
  return prop == 'defval' ? 'setpoint' : prop;
}

function isAnalog(item) {
  return item.cl == 'SensorA' || item.cl == 'ActorA';
}

module.exports = {
  getRootItem,
  formRecord,
  getSysDataFile,
  createTypes,
  createDevprops,
  createDevhard,
  createDevcurrent
};
