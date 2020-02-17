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
      /** 
        if (item.place) {
          parent = 'p' + item.place + (item.room ? 'r' + item.room : '');
        } else parent = 'place';
        */
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

    case 'types':
      robj = { _id: 't' + item.id, parent: item.cl, order: item.order, name: item.name };
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

function createTypeprops() {
  const classes = getSysDataFile('classes');
  const clObj = hut.arrayToObject(classes, 'id'); // Вывернуть

  const data = getSysDataFile('types');

  // сформировать строку
  let str = '';
  data.forEach(typeitem => {
    const clProps = clObj[typeitem.cl].props;
    clProps.forEach((pItem, idx) => {
      const pobj = Object.assign({ _id: 't' + typeitem.id + '_' + idx, type: 't' + typeitem.id }, pItem);
      str += JSON.stringify(pobj) + '\n';
    });
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
    console.log(item.dn + ' did=' + did);

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

  devhardData.forEach(item => {
    if (item.dn && item.unit && item.chan) {
      // Найдем id устройства по dn
      console.log(item.dn);
      const did = deviceObj[item.dn] ? deviceObj[item.dn]._id : '';

      if (!did) {
        console.log('NOT FOUND id for ' + item.id + ' in ' + devicesfile);
      } else {
        str += formHardRecord(did, item);
      }
    }
  });

  return str;
}

function formHardRecord(did, item) {
  const hard = getHardObjForUnit(item);
  if (!hard) return '';

  const pobj = {
    _id: did,
    did,
    prop:'value',
    unit: item.unit,
    chan: item.chan,
    hard,
    inv: item.inv,
    calc: item.calc,
    desc: item.desc
  };

  // if ((item.desc == 'DO' || item.desc == 'AO') && item.actions) {
  if (item.actions) {
    let actions;
    actions = hut.clone(item.actions, actions);
    pobj.hard.actions = actions;
  }

  return JSON.stringify(pobj) + '\n';
}

function getHardObjForUnit(item) {
  const plugin = hut.removeLastNumFromStr(item.unit);
  switch (plugin) {
    case 'mqttclient':
      return { topic: item.topic };
    case 'modbus':
        return { address: item.address, vartype:item.vartype, fcr:item.fcr, ks:item.ks,ks0:item.ks0};  
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
  createTypeprops,
  createDevprops,
  createDevhard,
  createDevcurrent
};
