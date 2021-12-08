/**
 * CLI module for project transfer from Berry
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const appconfig = require('../../lib/appconfig');
const hut = require('../../lib/utils/hut');
const fileutil = require('../../lib/utils/fileutil');

const tut = require('./../transfer_utils');
const tuberry = require('./transfer_berry_utils');
const tuberry_scenes = require('./transfer_berry_scenes');

const sysfiles = ['classes', 'types'];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let lang;
let project_c;
let project_d;

(async () => {
  const folder_c = await question('Имя папки проекта v3 (Berry): ');
  const folder_d = await question('Имя папки проекта v5 (D): ');

  // TODO - могли задать полный путь!
  project_c = path.join('/var/lib/intrahouse-b/', folder_c); // ТОЛЬКО ДЛЯ ОТЛАДКИ. Фактический путь будет внутри intrahouse/base
  project_d = path.join('/var/lib/intrahouse-d/projects/', folder_d);

  // Если новый проект не существует, создать структуру папок
  // Папки и файлы проектов общедоступны
  process.umask(0);
  // const appdir = path.join(__dirname, '../'); // Это путь к app.js
  const appdir = path.resolve(process.cwd());

  const configdir = path.join(appdir, '../'); // Это путь к config.json в папке intrahouse-d

  // Но имя проекта будет другое, не из config!!!
  // appconfig.start(appdir, configdir, folder_d);

  console.log('Start trasfer from ' + project_c + ' to ' + project_d);
  lang = 'ru';
  console.log('lang=' + lang);

  // transfer дописывает в один файл
    // lists
    add(formAllStr('places', 'jbase'), 'lists', 'jbase');
    add(formAllStr('rooms', 'jbase'), 'lists', 'jbase');
  
  /*
  transfer('classes', 'lists', 'jbase');
  transfer('places', 'lists', 'jbase');
  transfer('rooms', 'lists', 'jbase');
  transfer('spaces', 'lists', 'jbase');
  transferPluginGroups();
  */
  
  

  // transfer('scengroups', 'lists', 'jbase'); // only Berry

  // create создает заново
  create('types', 'jbase');
  create('devices', 'jbase');
  /*
  create('layouts', 'jbase');
  create('visconts', 'jbase');
  create('vistemplates', 'jbase');

  

  // create('charts', 'jbase');
  // create('reports', 'jbase');

  
  */
 
  create('units', 'jbase');

  // create('devhard', 'jbase');
  // create('scenecalls', 'jbase');

  // - create('devcurrent', 'operative');

  // Генерировать сценарии. В в scenes НЕ дописывать, при перезагрузке должны сами взяться
  // НЕТ - нужно вписать группу? Сделать операцией transfer
  // genLineScenes();
  // transfer('linescen', 'scenes', 'jbase');

  // genOnScenes();
  // transfer('onscen', 'scenes', 'jbase');

  // genSceneFromScenebase();
  // genSceneFromScenepat();

  rl.close();
})();

function question(str) {
  return new Promise(resolve => {
    rl.question(str, answer => {
      resolve(answer);
    });
  });
}

 /** add
   * Добавляет записи в таблицу V5
   *
   * @param {String} str - строка сформированная для db
   * @param {String} target - имя таблицы в V5 (db)
   * @param {String} folder - имя папки
   */
  function add(str, target, folder) {
    try {
      const dfilename = path.join(project_d, folder, target + '.db');
      fs.appendFileSync(dfilename, str);
    } catch (e) {
      console.log('ERROR: Transfer ' + target + ': ' + util.inspect(e));
      // emitMes('ERROR: Transfer ' + target + ': ' + hut.getShortErrStr(e));
    }
  }

  function formAllStr(source, folder) {
    let str = '';
    const data = tut.getSourceData(source, folder, project_c);
    let order = 0;
    data.forEach(item => {
      order += 1000;
      item.order = order;
      str += tut.formRecord(source, item);
    });
    return str;
  }

function getSourceAsObj(source, folder) {
  // const extdata = getSourceData('subsystems', 'jbase');
  const extdata = getSourceData(source, folder);
  const sObj = {};
  if (extdata) {
    extdata.forEach(item => {
      if (item.id && item.name) {
        // sObj[item.id] = getNameProp(item.name);
        sObj[item.id] = item.name;
      }
    });
  }
  return sObj;
}

// Может быть так: "name":{"en":"Counters","ru":"Счетчики"}
function getNameProp(val) {
  return typeof val == 'object' ? val[lang] : val;
}

function transfer(source, target, folder, extObj) {
  try {
    const data = getSourceData(source, folder);

    // сформировать строку
    // let str = tut.getRootItem(source);  - Можно не делать, сделает основной движок
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

function formAllRecordsStr(source, target, folder) {
  let str = '';

  const data = getSourceData(source, folder);

  let order = 0;
  data.forEach(item => {
    order += 1000;
    item.order = order;
    str += tut.formRecord(source, target, item);
  });
  return str;
}

function genLineScenes() {
  const data = getSourceData('linescen', 'jbase');
  data.forEach(item => {
    const scriptStr = tuberry_scenes.createLineScene(item);
    const filename = path.join(project_d, 'scenes', 'script', 'line' + item.id + '.js');
    // fs.writeFileSync(filename, scriptStr);
    console.log('file:' + filename + '\n');
    console.log(scriptStr);
  });
}

function genOnScenes() {
  const data = getSourceData('onscen', 'jbase');
  // "id": "onDP202_1"
  data.forEach(item => {
    const scriptStr = tuberry_scenes.createOnScene(item);
    const filename = path.join(project_d, 'scenes', 'script', item.id + '.js');
    fs.writeFileSync(filename, scriptStr);
    console.log('file:' + filename + '\n');
    console.log(scriptStr);
  });
}

// Шаблонные сценарии
// ПАПКА scenpat находится в сервере, нужно ее перенести в проект вручную?
function genSceneFromScenepat() {
  // Считать все файлы из папки. Повторить для каждого файла
  const folder = path.join(project_c, 'scenpat');
  // const files = fileutil.readFolderSync(folder, { ext: 'pat' });
  const files = ['fm_lightdd.pat'];
  files.forEach(file => {
    let data = getSourceData(file, 'scenpat');
    let str = '';
    let order = 10;
    console.log('FILE = ' + file);
    

    if (!Array.isArray(data)) data = [data];

      data.forEach(item => {
        item.id = item.patname;
        item.name = getNameProp(item.patnote);
        item.description = getNameProp(item.comment);
        item.order = order;
        order += 10;
        console.log('item = ' + util.inspect(item));
        const scriptStr = tuberry_scenes.createSceneFromScenepat(item, lang);

        const filename = path.join(project_d, 'scenes', 'script', item.id + '.js');
        // fs.writeFileSync(filename, scriptStr);
        console.log('file:' + filename + '\n');
        console.log(scriptStr);
        // const robj = tut.getScenesObj(item);
        // str += robj ? JSON.stringify(robj) + '\n' : '';
      });
    
    // Нужно добавить в scenes
    // Записать в файл
    /*
   const dfilename = path.join(project_d, 'jbase', 'scenes.db');

   fs.appendFileSync(dfilename, str);
   */
    // console.log(str);
    // console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  });
}
function genSceneFromScenebase() {
  // Считать все файлы из папки. Повторить для каждого файла
  const folder = path.join(project_c, 'scenbase');
  const files = fileutil.readFolderSync(folder, { ext: 'json' });

  files.forEach(file => {
    const data = getSourceData(file, 'scenbase');
    let str = '';
    let order = 10;
    data.forEach(item => {
      item.id = item.scenname;
      item.name = item.note;
      item.order = order;
      order += 10;
      const scriptStr = tuberry_scenes.createSceneFromScenebase(item);

      const filename = path.join(project_d, 'scenes', 'script', item.id + '.js');
      // fs.writeFileSync(filename, scriptStr);
      console.log('file:' + filename + '\n');
      console.log(scriptStr);
      const robj = tut.getScenesObj(item);
      str += robj ? JSON.stringify(robj) + '\n' : '';
    });

    // Нужно добавить в scenes
    // Записать в файл
    /*
   const dfilename = path.join(project_d, 'jbase', 'scenes.db');

   fs.appendFileSync(dfilename, str);
   */
    console.log(str);
    // console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  });
}

function create(target, folder) {
  try {
    let str = '';
    let sObj;

    switch (target) {
      // Berry!!
      case 'types':
        // К стандартным типам добавить типы из hman
        str = tut.createTypes();

        str += tuberry.createTypesFromHman(getSourceData('hmanPLC', 'jbase'), 'PLC');

        break;

      case 'devices':
        sObj = getSourceAsObj('subsystems', folder);

        str = tuberry.createDevices(
          getSourceData('devref', folder),
          project_d,
          sObj,
          getSourceData('hmanPLC', 'jbase')
        );
        break;

      case 'devhard':
        // str = tuberry.createDevhardFromHdev(getSourceData('hdevPLC', 'jbase'), 'PLC');

        // Получить devhard для unit
        const unit = 'PLC';
        const devhard = getSourceData('devhard', 'jbase');
        const darr = devhard.filter(item => item.unit == unit);
        const hObj = hut.arrayToObject(darr, 'chan'); // Вывернуть по chan
        str = tuberry.createDevhardFromHdev(getSourceData('hdevPLC', 'jbase'), unit, hObj);

        break;
      case 'devcurrent':
        str = tut.createDevcurrent(getSourceData('devcurrent', folder), project_d);
        break;

      case 'charts':
        str = tut.createFromMainAndSlave(
          getSourceData('chartlist', folder),
          getSourceData('charts', folder),
          'chartid',
          'chartgroup',
          { pref: 'c', len: 3 }
        );
        break;
      case 'reports':
        str = tut.createFromMainAndSlave(
          getSourceData('reportlist', folder),
          getSourceData('reportcolumns', folder),
          'repid',
          'reportgroup',
          { pref: 'r', len: 3 }
        );
        break;

      case 'layouts':
        str = formAllRecordsStr('layouts', target, folder);
        break;

      case 'visconts':
        str = formAllRecordsStr('mnemoschemes', target, folder);
        break;

      case 'vistemplates':
        str = tut.createVistemplates();
        break;

      case 'units':
        // str = formPluginFolders() + formAllRecordsStr('units', target, folder);
        str = formAllRecordsStr('units', target, folder);
        break;

      case 'scenecalls':
        // str = formAllRecordsStr('scenecall', target, folder);
        str = tut.createScenecalls(getSourceData('scenecall', folder), project_d);
        break;
      default:
    }

    // Записать в новый файл
    const dfilename = path.join(project_d, folder, target + '.db');
    fs.writeFileSync(dfilename, str);
    // console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log(util.inspect(e));
  }
}

function transferPluginGroups() {
  try {
    // Считать файл units
    const data = getSourceData('units', 'jbase');

    // Выбрать уникальные плагины
    const plSet = new Set();
    data.forEach(item => {
      if (item.id != item.plugin) plSet.add(item.plugin);
    });

    let str = '';
    let order = 100;
    for (const plugin of plSet) {
      str +=
        JSON.stringify({
          _id: 'plugin_' + plugin,
          folder: 1,
          parent: 'plugingroup',
          order,
          name: plugin.toUpperCase()
        }) + '\n';
      order += 100;
    }

    // Записать в файл
    const dfilename = path.join(project_d, 'jbase', 'lists.db');

    fs.appendFileSync(dfilename, str);
    console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log(util.inspect(e));
  }
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
    const data = getSourceData('units', 'jbase');

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
// auxiliary - вспомогательный, добавочный, дополнительный

// Changed for BERRY!!
function getSourceData(source, folder) {
  if (sysfiles.includes(source)) {
    return tut.getSysDataFile(source);
  }

  // Считать файл из проекта
  const file = source.indexOf('.') > 0 ? source : source + '.json';
  const cfilename = path.join(project_c, folder, file);
  if (!fs.existsSync(cfilename)) {
    console.log('File not found: ' + cfilename);
    return [];
  }

  const data = JSON.parse(fs.readFileSync(cfilename, 'utf8'));

  if (Array.isArray(data) && data.length) {
    // num=> id, num:0 - не берем!
    // name может быть object
    // Если есть order - сортировать по order
    const arr = [];
    let hasOrder;
    data.forEach(item => {
      if (item.num != '0') {
        if (item.name) {
          item.name = getNameProp(item.name);
        } else if (item.note) {
          item.name = getNameProp(item.note); // devref:{dn, note:}
        }
        if (item.kind) item.cl = item.kind;
        if (item.subsystem) item.subs = item.subsystem;
        const id = source == 'devref' ? item.dn : item.num;
        arr.push({ id, ...item });
        hasOrder = !!item.order;
      }
    });
    return hasOrder ? arr.sort(hut.byorder('order')) : arr;
  }
  return data;
}
