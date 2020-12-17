/**
 * Функции переноса проектов версии V4
 */


const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const tut = require('./transfer_utils');

const sysfiles = ['classes', 'types'];

function addlists(project_c, project_d) {
  // add({source:'classes', target:'lists', folder:'jbase', project_c, project_d});
  add({ source: 'places', target: 'lists', folder: 'jbase', project_c, project_d });
  add({ source: 'rooms', target: 'lists', folder: 'jbase', project_c, project_d });
  add({ source: 'spaces', target: 'lists', folder: 'jbase', project_c, project_d });
  return 'Transfer places, rooms';
}

function add({ source, target, folder, extObj, project_c, project_d }) {
  try {
    const data = getSourceData(source, folder, project_c);

    // сформировать строку
    let str = '';
    let order = 0;
    data.forEach(item => {
      order += 1000;
      item.order = order;
      str += tut.formRecord(source, target, item, extObj);
    });

    const dfilename = path.join(project_d, folder, target + '.db');
    fs.appendFileSync(dfilename, str);
    console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log(util.inspect(e));
  }
}

function create({ target, folder, project_c, project_d }) {
  let resMsg = 'Transfer ' + target;
  try {
    let str = '';
    let sObj;

    switch (target) {
      case 'types':
        str = tut.createTypes();
        break;

      case 'devices':
        sObj = getSourceAsObj('subsystems', folder);
        str = tut.createDevices(getSourceData('devref', folder, project_c), project_d, sObj);
        break;

      case 'images':
        sObj = getSourceAsObj('imagegroups', folder);
        str = formImageFolders() + tut.createImages(getSourceData('imagelist', folder, project_c), project_d, sObj);
        break;

      case 'layouts':
        str = formAllRecordsStr('layouts');
        break;

      case 'visconts':
        str = formAllRecordsStr('mnemoschemes');
        break;

      case 'vistemplates':
        str = tut.createVistemplates();
        break;

      case 'devhard':
        str = tut.createDevhard(getSourceData('devhard', folder, project_c), project_d);
        break;

      case 'devcurrent': // ПАРАМЕТРЫ??
        str = tut.createDevcurrent(getSourceData('devcurrent', folder, project_c), project_d);
        break;

      case 'charts':
        str = tut.createFromMainAndSlave(
          getSourceData('chartlist', folder, project_c),
          getSourceData('charts', folder, project_c),
          'chartid',
          'chartgroup',
          { pref: 'c', len: 3 }
        );
        break;
      case 'reports':
        str = tut.createFromMainAndSlave(
          getSourceData('reportlist', folder, project_c),
          getSourceData('reportcolumns', folder, project_c),
          'repid',
          'reportgroup',
          { pref: 'r', len: 3 }
        );
        break;

      case 'units':
        str = formPluginFolders() + formAllRecordsStr('units');
        break;

      case 'scenecalls':
        // str = tut.createScenecalls(getSourceData('scenecall'), project_d);
        break;
      default:
    }

    // Записать в новый файл
    const dfilename = path.join(project_d, folder, target + '.db');
    fs.writeFileSync(dfilename, str);
    console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log('ERROR: transfer: ' + util.inspect(e));
    resMsg += '. ERROR: ' + hut.getShortErrStr(e);
  }
  return resMsg;

  function getSourceAsObj(source) {
    // const extdata = getSourceData('subsystems', 'jbase');
    const extdata = getSourceData(source, folder, project_c);
    const sObj = {};
    if (extdata) {
      extdata.forEach(item => {
        if (item.id && item.name) sObj[item.id] = item.name;
      });
    }
    return sObj;
  }

  function formAllRecordsStr(source) {
    let str = '';

    const data = getSourceData(source, folder, project_c);

    let order = 0;
    data.forEach(item => {
      order += 1000;
      item.order = order;
      str += tut.formRecord(source, target, item);
    });
    return str;
  }

  function formImageFolders() {
    // Все будет храниться в units, корневая тоже
    const rootId = 'imagegroup';
   let str = '';
    let order = 10;
    try {
      const data = getSourceData('imagegroups', 'jbase', project_c);
      data.forEach(item => {
        str +=
        JSON.stringify({
          _id: 'img'+item.id,
          folder: 1,
          parent: rootId,
          order,
          name: item.name
        }) + '\n';
      order += 10;
      });
    } catch (e) {

    }
    return str;
  }

  function formPluginFolders() {
    // Все будет храниться в units, корневая тоже
    const rootId = 'unitgroup';
    let str =
      JSON.stringify({
        _id: rootId,
        folder: 1,
        parent: 0,
        name: 'Plugins'
      }) + '\n';

    try {
      // Считать файл units
      const data = getSourceData('units', 'jbase', project_c);

      // Выбрать плагины НЕ single - только для них делаю папки
      const plSet = new Set();
      data.forEach(item => {
        if (item.id != item.plugin) plSet.add(item.plugin);
      });

      let order = 100;
      for (const plugin of plSet) {
        str +=
          JSON.stringify({
            _id: 'plugin_' + plugin,
            folder: 1,
            parent: rootId,
            order,
            name: plugin.toUpperCase()
          }) + '\n';
        order += 100;
      }
    } catch (e) {
      console.log(util.inspect(e));
    }
    return str;
  }
}

function getSourceData(source, folder, project_c) {
  if (sysfiles.includes(source)) {
    return tut.getSysDataFile(source);
  }

  // Считать файл из проекта
  const cfilename = path.join(project_c, folder, source + '.json');
  return JSON.parse(fs.readFileSync(cfilename, 'utf8'));
}

module.exports = {
  create,
  add,
  addlists
};
