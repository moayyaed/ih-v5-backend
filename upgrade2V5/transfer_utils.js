/**
 *  transfer_utils.js
 */

// const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const appconfig = require('../lib/appconfig');

const sysfiles = ['classes', 'types'];

/**
 * Cчитать файл из исходного проекта
 * @param {String} source
 * @param {String} folder
 * @return {Array of Object}
 */
function getSourceData(source, folder, project_c) {
  if (sysfiles.includes(source)) return getSysDataFile(source);

  const cfilename = path.join(project_c, folder, source + '.json');
  return fs.existsSync(cfilename) ? JSON.parse(fs.readFileSync(cfilename, 'utf8')) : [];
}

function getSourceAsObj(source, folder, project_c) {
  const extdata = getSourceData(source, folder, project_c);
  const sObj = {};
  extdata.forEach(item => {
    if (item.id && item.name) sObj[item.id] = item.name;
  });
  return sObj;
}

function getPlaceId(item) {
  return 'dg' + item.id;
}

function getRoomId(item) {
  return 'dg' + item.place + 'r' + item.id;
}

/**
 * Сформировать строку для одной записи в новом формате
 * 
 * @param {String} source - имя исходной таблицы
 * @param {Object} item - исходная запись
 */
function formRecord(source, item) {
  let robj = {};
  let parent;
  let _id;
  switch (source) {
    // places - id будет dgxx или dgxxryy, хотя дальше будет dg000
    case 'places':
      // robj = { _id: 'dg' + item.id, list: 'place', parent: 'place', order: item.order, name: item.name };
      robj = { _id: getPlaceId(item), list: 'place', parent: 'place', order: item.order, name: item.name };
      break;

    case 'rooms':
      parent = 'dg' + item.place;
      // robj = { _id: 'dg' + item.place + 'r' + item.id, list: 'place', parent, order: item.order, name: item.name };
      robj = { _id: getRoomId(item), list: 'place', parent, order: item.order, name: item.name };
      break;

    case 'spaces': // => lists- layoutgroup
      _id = getNewId('lg', 3, item.id);
      robj = { _id, list: 'layoutgroup', parent: 'layoutgroup', order: item.order, name: item.name };
      break;

    case 'imagegroups':
      robj = item.id ? { _id: 'img' + item.id, folder: 1, parent:'imagegroup', order: item.order, name: item.name } : '';
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

    case 'units':
      robj = getUnitObj(item, 'unitgroup');
      break;

    case 'scengroups': // BERRY => lists- scenegroup
      robj = { _id: 'sg' + item.id, list: 'scenegroup', parent: 'scenegroup', order: item.order, name: item.name };
      break;

    case 'linescen': // BERRY => linescen-> scenes
      // {id: 3,  name: 'Перезагрузка роутеров',group: 2};
      // { _id: 'line3', status: '1',name: 'Перезагрузка роутеров', parent: 'sg2', version: '4',multi: 0};
      robj = {
        _id: 'line' + item.id,
        parent: 'sg' + item.group,
        status: '1',
        txt: item.description || '',
        order: item.order,
        name: item.name,
        version: '4',
        multi: 0
      };
      break;
    case 'onscen': // BERRY => onscen-> scenes
      // Групп нет, все в корень
      // { _id: 'line3', status: '1',name: 'Перезагрузка роутеров', parent: 'sg2', version: '4',multi: 0};
      robj = {
        _id: item.id,
        parent: 'scenegroup',
        status: '1',
        txt: item.description || '',
        order: item.order,
        name: item.name || item.id,
        version: '4',
        multi: 0
      };
      break;
    default:
      robj = '';
      console.log('formRecord: Not found source ' + source);
  }
  return robj ? JSON.stringify(robj) + '\n' : '';
}

/**
 *
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


// SCENES
function getScenesObj(item) {
  return {
    _id: item.id,
    parent: item.parent || 'scenegroup',
    status: '1',
    txt: item.description || '',
    order: item.order,
    name: item.name || item.id,
    version: '4',
    multi: 0
  };
}

function getUnitObj(item, rootId) {
  let parent;
  let plugin;
  if (item.plugin) {
    parent = item.id != item.plugin ? 'plugin_' + item.plugin : rootId;
    plugin = item.plugin;
  } else {
    parent = rootId;
    plugin = item.id;
  }

  const _id = getNewId('u', 3, item.id);
  const robj = { _id, parent, plugin };
  Object.keys(item).forEach(prop => {
    if (!prop.endsWith('_') && !['laststart_str', 'laststop_str', 'errstr', 'folder'].includes(prop))
      robj[prop] = item[prop];
    robj.active = 1;
    robj.suspend = 1;
  });
  return robj;
}

function getSysDataFile(source) {
  // Считать, перевести??
  const cfilename = path.join(__dirname, 'sysbase_c', source + '.json');
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
    // _id = getNewId('t', 3, item.id);
    _id = item.id;
    const robj = { _id, parent: 'typegroup', order, name: item.name, fuse: 1 };
    robj.props = clObj[item.cl].props;
    str += JSON.stringify(robj) + '\n';
    order += 1000;
  });
  return str;
}

function createVistemplates() {
  const data = getSysDataFile('types');
  // сформировать строку
  const parent = 'vistemplategroup'; // все в корень
  let str = '';
  let order = 1000;
  let _id;
  data.forEach(item => {
    _id = getNewId('vt', 3, item.id);
    const robj = { _id, parent, order, name: item.name };
    str += JSON.stringify(robj) + '\n';
    order += 1000;
  });
  return str;
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


function getNewId(pref, len, oldId) {
  return isNaN(oldId) ? oldId : pref + String(Number(oldId)).padStart(len, '0');
}

module.exports = {
  getSourceData,
  getSourceAsObj,

  createFromMainAndSlave,
  formRecord,
  getSysDataFile,
  createTypes,

  createScenecalls,
  createVistemplates,

  getPlaceId,
  getRoomId,
  getNewId,
  getScenesObj
};
