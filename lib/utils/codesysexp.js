/**
 * codesysexp.js
 *  - parse - импорт объектов из строки
 *
 */

const util = require('util');
// const fs = require('fs');

const hut = require('./hut');

const otherProps = ['blk_', 'setpoint_', 'p_', 'dimset_'];

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
    .filter(line => line && line.indexOf('AT') > 0 && !line.startsWith('(*'));

  if (!lines || !lines.length) throw { message: 'No data for parse!' };

  // console.log('LINES:' + util.inspect(lines));

  // Собрать все on_, off_
  const onoffSet = {};
  lines.forEach(line => {
    if (line.startsWith('on_') || line.startsWith('off_') || line.startsWith('up_') || line.startsWith('down_')) {
      const arr = line.split(/\s+/);
      if (arr.length > 2 && arr[1] == 'AT' && arr[2].startsWith('%')) {
        // Запомнить массив
        onoffSet[arr[0]] = arr;
        // onoffSet[arr[0]] = getAdrObj(arr[2], true, arr.join(' '));
      }
    }
  });

  // Собрать другие с префиксами  (setpoint_, p_)
  const otherSet = {};
  lines.forEach(line => {
    if (isNeedfulLine(line)) {
      const arr = line.split(/\s+/);
      if (arr.length > 2 && arr[1] == 'AT' && arr[2].startsWith('%')) {
        // Вычислить адрес в зависимости от типа
        otherSet[arr[0]] = arr;
        // otherSet[arr[0]] = getAdrObj(arr[2], false, arr.join(' '));
      }
    }
  });

  // Формировать записи
  // Корневая папка всегда ALL

  const docs = [{ folder_title: 'ALL' }];
  lines.forEach((line, lidx) => {
    if (line.indexOf('(*@') > 0) {
      // console.log('N ' + lidx + ': ' + line);
      const xx = /\*@(.*)@\*/.exec(line); // Ищем (*@state,on,off@*) или (*INV!@state,on,off@*)

      // xx[1] - state,on,of или INV!@state,on,off
      if (xx && xx[1]) {
        // const propArr = xx[1].substr(3, arr[3].length - 6).split(',');
        let devinv = 0;
        if (xx[1].startsWith('INV!')) {
          devinv = 1;
          xx[1] = xx[1].substr(4);
        }
        const propArr = xx[1].split(/\s*,\s*/); // state,on,off  value&dimset,on,off

        const arr = line.split(/\s+/);

        if (arr[1] == 'AT' && arr[2].startsWith('%') && (arr[3].startsWith('(*@') || arr[4].startsWith('(*@'))) {
          const dn = arr[0];

          const did = findDeviceDid(dn);

          propArr.forEach((iprop, idx) => {
            let [prop, writeProp] = iprop.split('&'); // value&dimset

            const chan = dn + '_' + prop;
            // let address = arr[2].substr(3);
            let adrObj;
            let txt;
            if (prop == 'on' || prop == 'off') {
              const xprop = devinv ? (prop == 'on' ? 'off' : 'on') : prop;
              const xarr = onoffSet[xprop + '_' + dn];
              adrObj = getAdrObj(xarr[2], true, xarr.join(' '));
            } else if (prop == 'up' || prop == 'down') {
              const xprop = devinv ? (prop == 'up' ? 'down' : 'up') : prop;
              const xarr = onoffSet[xprop + '_' + dn];
              adrObj = getAdrObj(xarr[2], true, xarr.join(' '));
            }else if (idx == 0) {
              // Первый элемент - основной канал
              adrObj = getAdrObj(arr[2]);
              if (devinv) adrObj.inv = devinv;
              txt = arr.join(' ');

              if (writeProp) {
                // Канал для чтения/записи
                // Если имя свойства совпадает - адрес одинаковый, только w:1
                adrObj.w = 1;
                if (prop != writeProp) {
                  // Найти адрес в otherSet
                  const xarr = otherSet[writeProp + '_' + dn];
                  const writeObj = getAdrObj(xarr[2], true);
                  txt += ' WRITE: ' + xarr.join(' ');
                  adrObj.diffw = 1;
                  adrObj.waddress = writeObj.address;
                  adrObj.wvartype = writeObj.vartype;
                }
              }
            } else {
              // Дополнительный канал  - setpoint, blk,.., but1??
              // let otherProp = prop.startsWith('but') ? 'p_' + dn + '_' + prop : prop + '_' + dn;
              // Сценарники - p_<dn>_but1 - не используется
              let otherProp = prop + '_' + dn;

              const xarr = otherSet[otherProp];
              if (xarr) {
                if (prop == 'blk') {
                  // Читаем-пишем битовое значение
                  adrObj = getRWBitObj(xarr[2]);
                } else {
                  adrObj = getAdrObj(xarr[2], false);
                }
                txt = xarr.join(' ');
                if (writeProp) {
                  // Пока один адрес для чтения-записи доп параметров
                  adrObj.w = 1;
                }
              } else {
                console.log('ERROR: codesysexp: NOT FOUND ' + otherProp);
              }
            }

            const didObj = did ? { did, prop } : '';
            docs.push({ parent_title: 'ALL', chan, txt, ...adrObj, ...didObj, devpropname: prop, unitid: 1 });
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
  const resObj = w ? writeAdr(xx, Number(adr), Number(offset), '1') : readAdr(xx, Number(adr), Number(offset));
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
      return { vartype: 'int16', address: adr, r: 1, fcr: '3', gr: 1 };
    case 'IX':
      return { vartype: 'int16', address: adr, bit: 1, offset, r: 1, fcr: '3', gr: 1 }; // Чтение словами, выделяется бит по смещению
    case 'QW':
      // АНАЛОГОВЫЕ АКТУАТОРЫ - ДИММЕРЫ
      return {
        vartype: 'int16',
        address: adr + 512,
        r: 1,
        fcr: '3',
        gr: 1,
        usek: 1,
        ks0: 0,
        ks: 100,
        kh0: 0,
        kh: 32767
      };
    case 'QX':
      return { vartype: 'int16', address: adr + 512, bit: 1, offset, r: 1, fcr: '3', gr: 1 };
    case 'MW':
      return { vartype: 'int16', address: adr + 12288, r: 1, fcr: '3', gr: 1 };
    case 'MX':
      return { vartype: 'int16', address: adr + 12288, bit: 1, offset, r: 1, fcr: '3', gr: 1 };
    default:
      console.log('WARN: codesysexp: read address ??? %' + xx);
  }
}


function getRWBitObj(aStr) {
  // aStr = '%MX20.3:BOOL'
  const arr = aStr.substr(3).split(':');
  /*
  if (arr.length < 2) {
    console.log('WARN: codesysexp: Error address: ' + aStr);
    return;
  }
  */
  const xx = aStr.substr(1, 2); // IX, QX, MX, IW, QW, MW

  const [adr, offset] = arr[0].split('.');
  const resObj = readWriteBitAdr(xx, Number(adr), Number(offset)) ;
  return resObj;
}

function readWriteBitAdr(xx, adr, offset) {
  switch (xx) {
    case 'MX':
      return { vartype: 'bool', address: adr * 16 + offset + 12288, r: 1, w: 1, fcr: '2', gr: 1 };
    case 'QX':
      return { vartype: 'bool', address: adr * 16 + offset + 512,  r: 1, w: 1, fcr: '2', gr: 1 };

    default:
      console.log('WARN: codesysexp: read bit address ??? %' + xx);
  }
}

function isNeedfulLine(line) {
  for (const pref of otherProps) {
    if (line.startsWith(pref)) return true;
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
