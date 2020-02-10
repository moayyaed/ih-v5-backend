/**
 *
 */
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
      if (item.place) {
        parent = 'p' + item.place + (item.room ? 'r' + item.room : '');
      } else parent = 'place';

      robj = { _id: 'd' + item.id, parent, order: item.order, type:'t'+item.type, dn: item.dn, name: item.dn + ' ' + item.name };
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
      const pobj = Object.assign({ id: 't' + typeitem.id + '_' + idx, type: 't' + typeitem.id }, pItem);
      str += JSON.stringify(pobj) + '\n';
    });
  });
  return str;
}

function createDevprops(project_d) {
  const tpMap = new Map();
  const typepropfile = path.join(project_d, 'jbase', 'typeprops.db');
  const tstr = fs.readFileSync(typepropfile, 'utf8');
  const tparr = tstr.split('\n');
  tparr.forEach(sItem => {
    sItem = hut.allTrim(sItem);
    if (sItem) {
      const tpItem = JSON.parse(sItem);
      if (!tpMap.has(tpItem.type)) tpMap.set(tpItem.type, []);
      tpMap.get(tpItem.type).push(tpItem);
    }
  });
  
  let str = '';
  const devicesfile = path.join(project_d, 'jbase', 'devices.db');
  const dstr = fs.readFileSync(devicesfile, 'utf8');
  const dparr = dstr.split('\n');
  dparr.forEach(sItem => {
    sItem = hut.allTrim(sItem);
    console.log(sItem);
    if (sItem) {
      const item = JSON.parse(sItem);
      
      // Найдем нужный тип и добавим свойства
      if (tpMap.has(item.type)) {
        tpMap.get(item.type).forEach(propItem => {
        const pobj = { id: item.dn + '_' +propItem.prop, dn: item.dn, prop:propItem.prop, chan:{}, aux:{} };
        str += JSON.stringify(pobj) + '\n';
        });
      } else {
        console.log('Type not found:'+item.type);
      }
    }
  });

  return str;
  // const devicesfile = path.join(project_d, 'jbase',  'devices.db');
}

module.exports = {
  getRootItem,
  formRecord,
  getSysDataFile,
  createTypeprops,
  createDevprops
};
