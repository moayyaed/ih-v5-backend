/**
 *  transfer_devhard.js
 */

const util = require('util');

const hut = require('../lib/utils/hut');
const tut = require('./transfer_utils');

/**
 *  V4: devhard содержит связки dn - unit, chan, если complex=false
 * 
 *  V5: нужно для каждого свойства отдельно (обычно prop:value)
 *   _id - новый, подряд; did= devices._id
 *    {id, did, prop, unit, chan, <inv,...>, <hard св-ва канала>} 
 
 * @param {Object} devicesMap - 
 * @param {String} project_с
 */
module.exports = function createDevhard(devicesMap, project_c) {
  const devhardData = tut.getSourceData('devhard', 'jbase', project_c);
  devhardData.sort(hut.byorder('chan'));

  let order = 1000;
  const complexMap = new Map();
  let str = '';
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
        const did = devicesMap[item.dn] ? devicesMap[item.dn]._id : '';

        if (!did) {
          console.log('WARN: Transform devhard. NOT FOUND device id for record: ' + util.inspect(item));
        } else {
          item.order = order;
          str += formHardRecord(did, item, devicesMap[item.dn].props.value ? 'value' : 'state');
          order += 1000;
        }
      }
    }
  });

  // TODO Сформировать из комплексных каналов ( wip)
  complexMap.forEach((arr, dn) => {
    const did = devicesMap[dn] ? devicesMap[dn]._id : '';
    if (did) {
      arr.forEach(item => {
        const prop = item.prop == 'dval' ? 'value' : item.prop;
        const cobj = {
          _id: did + '_' + prop,
          did,
          prop,
          unit: item.unit,
          chan: item.chan,
          desc: item.desc,
          order: item.order,
          r: item.op == 'R' ? 1 : 0,
          w: item.op == 'W' ? 1 : 0,
          value: item.value // Значение для команды
        };
        str += JSON.stringify(cobj) + '\n';
      });
    }
  });
  return str;
};

function formHardRecord(did, item, prop) {
  if (item.complex) return '';

  if (!item.chan) item.chan = item.dn;
  const pobj = {
    _id: did,
    did,
    prop,
    unit: item.unit,
    chan: item.chan,
    inv: item.inv,
    calc: item.calc,
    desc: item.desc,
    order: item.order,
    r: 1,
    w: item.desc == 'DO' || item.desc == 'AO' ? 1 : 0
  };

  const hard = getHardObjForUnit(item);
  const commands = [];
  // Может и не быть - например wip
  let robj;
  if (hard) {
    robj = Object.assign(pobj, hard);

    if (item.actions && Array.isArray(item.actions) && pobj.w) {
      // Сформировать отдельные каналы для on/off.
      // TODO Если set - присоедить команду записи к текущему каналу??

      item.actions.forEach(el => {
        if (el.act == 'set') {
          //
        } else {
          const act = el.act;
          const aObj = {
            _id: did + '_' + act,
            did,
            prop: act,
            unit: item.unit,
            chan: item.chan + '_' + act,
            r: 0,
            w: 1
          };
          commands.push({ ...el, ...aObj });
        }
      });
    }
  } else robj = pobj;

  let str = JSON.stringify(robj) + '\n';
  commands.forEach(command => {
    str += JSON.stringify(command) + '\n';
  });
  return str;
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

    case 'megad':
      // {"unit":"megad1","lost":0,"interval":15,"ip":"192.168.103.61"}
      return {
        req: item.req,
        reqsek: item.reqsek,
        ks: item.ks,
        kh: item.kh,
        weight: item.weight,
        restore: item.restore,
        set: item.set,
        usescript: item.usescript
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
