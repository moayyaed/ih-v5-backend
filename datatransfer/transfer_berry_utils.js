/**
 *  transfer_berry_utils.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const tut = require('./transfer_utils');

const hut = require('../lib/utils/hut');
const appconfig = require('../lib/appconfig');

function createTypesFromHman(hmanData, pref) {
  const data = hmanData[0]; // 0 элемент - description

  // сформировать строку
  let str = '';
  let order = 1000;

  Object.keys(data).forEach(key => {
    if (typeof data[key] == 'object') {
      const _id = pref + '_' + key;
      const item = data[key];
      const robj = { _id, parent: item.kind, order, name: item.name + ' (' + pref + ')', txt: item.comment };
      robj.props = getTypeProps(item.props);
      str += JSON.stringify(robj) + '\n';
      order += 1000;
    }
  });
  return str;
}

// [{"name":"dval", "var":"*","r":1},
// {"name":"on", "var":"fl_*","val":1,"w":1},
// {"name":"off", "var":"fz_*","val":1,"w":1}]

function getTypeProps(proparr) {
  const res = {};
  if (proparr) {
    proparr.forEach(item => {
      if (item.name == 'on' || item.name == 'off') {
        res[item.name] = { command: 1, name: item.name };
      } else {
        let propName;
        let vtype;
        let name;
        switch (item.name) {
          case 'dval':
            propName = 'value';
            vtype = 'B';
            name = appconfig.getMessage('Value');
            break;
          case 'aval':
            propName = 'value';
            vtype = 'N';
            name = appconfig.getMessage('Value');
            break;
          case 'defval':
            propName = 'setpont';
            vtype = 'N';
            name = appconfig.getMessage('Setpoint');
            break;
          case 'auto':
            propName = 'auto';
            vtype = 'B';
            name = 'Auto';
            break;
          case 'blk':
            propName = 'blk';
            vtype = 'B';
            name = appconfig.getMessage('Blk');
            break;
          default:
            propName = item.name;
            vtype = 'N';
            name = item.name;
        }
        const op = item.r && item.w ? 'rw' : item.r ? 'r' : 'w';
        res[propName] = { name, vtype, op };
      }
    });
  }
  return res;
}

function createDevices(devrefData, project_d, extObj, hmanPLC) {
  // Свойства формировать на основе классов (которые уже перенесены в типы)
  // ИЛИ на основе типа PLC
  const classes = tut.getSysDataFile('classes');
  const clObj = hut.arrayToObject(classes, 'id');
  console.log('clObj=' + util.inspect(clObj));
  // [{description:1,...},
  // {"id":"DT302", "cm":"TEMPPT1000","PLCIO":"IA11.1" },
  // ...]
  hmanPLC.shift();
  const hmanObj = hut.arrayToObject(hmanPLC, 'id');

  let str = '';

  // Вывернуть по  _id
  const placeObj = getDataObj(project_d, 'lists.db');
  const typesObj = getDataObj(project_d, 'types.db');

  let order = 1000;
  devrefData.forEach(item => {
    console.log('item =' + util.inspect(item));
    const type = getType(item);
    const dobj = {
      _id: item.id,
      parent: getParent(item),
      order,
      type,
      dn: item.dn,
      name: item.name,
      tags: getTags(item, extObj)
    };
    console.log('dobj =' + util.inspect(dobj));
    if (typesObj[type] && typesObj[type].props) {
      dobj.props = formProps(item, Object.keys(typesObj[type].props));
    }
    str += JSON.stringify(dobj) + '\n';
    order += 1000;
  });
  return str;

  function getType(item) {
    return hmanObj[item.dn] ? 'PLC_' + hmanObj[item.dn].cm : tut.getNewId('t', 3, item.type);
  }

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

  function getTags(item) {
    return item.subs && extObj[item.subs] ? [extObj[item.subs]] : [];
  }
}

function getDataObj(project_d, dbfile) {
  // const filename = path.join(project_d, 'jbase', 'lists.db');
  const filename = path.join(project_d, 'jbase', dbfile);
  const liststr = fs.readFileSync(filename, 'utf8');
  const arr = liststr.split('\n');

  // Вывернуть по  _id
  return hut.arrayToObject(
    arr.filter(item => hut.allTrim(item)).map(item => JSON.parse(item)),
    '_id'
  );
}

function formProps(item, propArr) {
  const pobj = {};
  propArr.forEach(prop => {
    pobj[prop] = formOneProp(item, prop);
  });

  return pobj;
}
function formOneProp(item, prop) {
  let mmObj;
  if (tut.isAnalog(item)) {
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

/*
{
    "id": "KH002_5",
    "name": "Светильник",
    "hmid": "LIGHT",
    "type": "510",
    "kind": "ActorD",
    "props": [
      { "name": "dval", "r": 1, "w": 0, "adr": "0172", "vtype": "BOOL", "mask": "0400" },
      { "name": "on", "r": 0, "w": 1, "adr": "2262", "vtype": "BOOL", "mask": "0001", "val": 1 },
      { "name": "off", "r": 0, "w": 1, "adr": "2264", "vtype": "BOOL", "mask": "0001", "val": 1 }
    ]
  },
  */

function createDevhardFromHdev(hdevData, unit) {
  let str = '';

  let order = 1000;

  hdevData.forEach(item => {
    if (item.id && item.props) {
      const did = item.id;
      item.props.forEach(propItem => {
        const chan = item.id + '_' + propItem.name;
        const hitem = { ...propItem };
        const prop = getPropName(propItem.name);
        delete hitem.name;
        const robj = { _id: unit + '_' + chan, unit, chan, did, prop, ...hitem };

        item.order = order;
        str += JSON.stringify(robj) + '\n';
        order += 1000;
      });
    }
  });

  return str;
}

function getPropName(prop) {
  switch (prop) {
    case 'dval':
    case 'aval':
      return 'value';
    case 'defval':
      return 'setpoint';
    default:
      return prop;
  }
}

/*
function formHardRecord(did, item) {
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
*/

module.exports = {
  createDevices,
  createDevhardFromHdev,
  createTypesFromHman
};
