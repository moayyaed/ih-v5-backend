/**
 * codesysexp.js
 *  - parse - импорт объектов из строки
 *
 */

const util = require('util');
// const fs = require('fs');

const hut = require('./hut');

/**
 *
 * @param {String} dataStr
 * @param {Object} options
 *
 * @return {Array of Objects} docs
 * @throw {message} - в случае ошибки
 *
 */
function parse(dataStr, options = {}, holder) {
  if (!dataStr || typeof dataStr != 'string') throw { message: 'Expect string for parse!' };
  const unit = options.unit;
  if (!unit) throw { message: 'Missing unit!' };

  // Распарсить по строкам  Удалить пробелы, \r , табуляции в каждой строке. Исключить пустые строки
  const lines = dataStr
    .split('\n')
    .map(line => hut.allTrim(line))
    .filter(line => line && line.indexOf('AT %') > 0 && !line.startsWith('(*'));

  if (!lines || !lines.length) throw { message: 'No data for parse!' };

  // Собрать все on_, off_
  const onoffSet = {};
  lines.forEach((line, lidx) => {
    if (line.startsWith('on_') || line.startsWith('off_')) {
      const arr = line.split(/\s+/);
      if (arr.length > 2 && arr[1] == 'AT' && arr[2].startsWith('%')) {
        // Вычислить битовый адрес MX770.2 = 770*16+2+ 12288 (0x3000)
        onoffSet[arr[0]] = getAdrObj(arr[2], true, arr.join(' '));
      }
    }
  });

  // Формировать записи
  // Корневая папка всегда ALL

  const docs = [{ folder_title: 'ALL' }];
  lines.forEach((line, lidx) => {
    if (line.indexOf('(*@') > 0) {
      console.log('N ' + lidx + ': ' + line);
      const xx = /\*@(.*)@\*/.exec(line); // (*@state,on,off@*)

      if (xx && xx[1]) {
        // const propArr = xx[1].substr(3, arr[3].length - 6).split(',');
        const propArr = xx[1].split(',');

        const arr = line.split(/\s+/);
        // if (arr[1] == 'AT' && arr[2].startsWith('%') && (arr[3].startsWith('(*@') || arr[4].startsWith('(*@'))) {
        if (arr[1] == 'AT' && arr[2].startsWith('%') && (arr[3].startsWith('(*@') || arr[4].startsWith('(*@'))) {
          const dn = arr[0];

          const did = findDeviceDid(dn);

         
          propArr.forEach(prop => {
            const chan = dn + '_' + prop;
            // let address = arr[2].substr(3);
            let adrObj;
            let txt;
            if (prop == 'on' || prop == 'off') {
              adrObj = onoffSet[prop + '_' + dn];

            } else {
              adrObj = getAdrObj(arr[2]);
              txt = arr.join(' ');
            }

            const didObj = did ? { did, prop } : '';
            docs.push({ parent_title: 'ALL', chan, txt, ...adrObj, ...didObj, devpropname:prop, unitid:1 });
          });
        }
      }
    }
  });
  // console.log(util.inspect(docs));
  return docs;

  function findDeviceDid(dn) {
    const dobj = holder.dnSet[dn];
    if (!dobj) {
      console.log('WARN: codesysexp: Not found device dn=' + dn);
      return;
    }
    return dobj._id;
  }
}

function getAdrObj(aStr, w, txt) {
  // aStr = '%MX770.3:BOOL'
  const arr = aStr.substr(3).split(':');
  /*
  if (arr.length < 2) {
    console.log('WARN: codesysexp: Error address: ' + aStr);
    return;
  }
  */
  const xx = aStr.substr(1, 2); // IX, QX, MX, IW, QW, MW

  const [adr, offset] = arr[0].split('.');
  const resObj =  w ? writeAdr(xx, Number(adr), Number(offset), "1") : readAdr(xx, Number(adr), Number(offset));
  if (txt) resObj.txt = txt;
  return resObj;
}

function writeAdr(xx, adr, offset, calc_out) {
  switch (xx) {
    case 'QW':
      return { vartype: 'int16', address: adr + 512, w: 1, calc_out };
    case 'MW':
      return { vartype: 'int16', address: adr + 12288, w: 1, calc_out };
    case 'QX':
      return { vartype: 'bool', address: adr * 16 + offset + 512, w: 1, calc_out };
    case 'MX':
      return { vartype: 'bool', address: adr * 16 + offset + 12288, w: 1, calc_out };
    default:
      console.log('WARN: codesysexp: write address  ??? %' + xx);
  }
}

function readAdr(xx, adr, offset) {
  switch (xx) {
    case 'IW':
      return { vartype: 'int16', address: adr, r: 1, fcr:'3', gr:1 };
    case 'IX':
      return { vartype: 'int16', address: adr, bit:1, offset, r: 1, fcr:'3', gr:1 }; // Чтение словами, выделяется бит по смещению
    case 'QW':
      return { vartype: 'int16', address: adr + 512, r: 1, fcr:'3', gr:1 };
    case 'QX':
      return { vartype: 'int16', address: adr + 512, bit:1, offset, r: 1, fcr:'3', gr:1 };
    case 'MW':
      return { vartype: 'int16', address: adr + 12288, r: 1, fcr:'3', gr:1 };
    case 'MX':
      return { vartype: 'int16', address: adr + 12288, bit:1, offset, r: 1, fcr:'3', gr:1 };
    default:
      console.log('WARN: codesysexp: read address ??? %' + xx);
  }
}

module.exports = {
  parse
};

/*
const x = {
  _id: '0-GXZx3-V7',
  order: 2000,
  parent: 'C2l1t8TLt',
  unit: 'modbus1',
  chan: '77_volt_1612717554136',
  desc: 'AO',
  vartype: 'int16',
  address: '0x1001',
  unitid: '77',
  pollp: true,
  fcr: '3',
  gr: true,
  usek: false,
  ks0: 0,
  ks: 100,
  kh0: 0,
  kh: 100,
  folder: 0,
  did: '',
  prop: ''
};
*/
