/**
 * CLI module for project transfer
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const appconfig = require('../lib/appconfig');
// const hut = require('../lib/utils/hut');
const tut = require('./transfer_utils');

const sysfiles = ['classes', 'types'];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let project_c;
let project_d;

(async () => {
  const folder_c = await question('Имя папки проекта v4 (C): ');
  const folder_d = await question('Имя папки проекта v5 (D): ');

  // TODO - могли задать полный путь!
  project_c = path.join('/var/lib/intrahouse-c/projects', folder_c);
  project_d = path.join('/var/lib/intrahouse-d/projects/', folder_d);

  // Если новый проект не существует, создать структуру папок
  // Папки и файлы проектов общедоступны
  process.umask(0);
  const appdir = path.join(__dirname, '../'); // Это путь к app.js
  const configdir = path.join(appdir, '../'); // Это путь к config.json в папке intrahouse-d

  // Но имя проекта будет другое, не из config!!!
  appconfig.start(appdir, configdir, folder_d);

  console.log('Start trasfer from ' + project_c + ' to ' + project_d);
  console.log('lang=' + appconfig.get('lang'));

  // transfer дописывает в один файл
  /** 
  transfer('classes', 'lists', 'jbase');
  transfer('places', 'lists', 'jbase');
  transfer('rooms', 'lists', 'jbase');
  transfer('spaces', 'lists', 'jbase');
  transferPluginGroups();
*/

  
  // create создает заново
  
  // create('layouts', 'jbase');
  // create('visconts', 'jbase');
  // create('vistemplates', 'jbase');

    
  // create('units', 'jbase');
  
  create('types', 'jbase');
 
  // create('devices', 'jbase');
  
  // create('devhard', 'jbase');
  // create('scenecalls', 'jbase');
 
  // - create('devcurrent', 'operative');
  // create('charts', 'jbase');
  // create('reports', 'jbase');
  

  rl.close();
})();

function question(str) {
  return new Promise(resolve => {
    rl.question(str, answer => {
      resolve(answer);
    });
  });
}

function getSourceAsObj(source, folder) {
  // const extdata = getSourceData('subsystems', 'jbase');
  const extdata = getSourceData(source, folder);
  const sObj = {};
  if (extdata) {
    extdata.forEach(item => {
      if (item.id && item.name) sObj[item.id] = item.name;
    });
  }
  return sObj;
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

function create(target, folder) {
  try {
    let str = '';
    let sObj;

    switch (target) {
      case 'types':
        str = tut.createTypes();
        break;

      case 'devices':
        sObj = getSourceAsObj('subsystems', folder);
        str = tut.createDevices(getSourceData('devref', folder), project_d, sObj);
        break;

      case 'devhard':
        str = tut.createDevhard(getSourceData('devhard', folder), project_d);
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
        str = formPluginFolders()+formAllRecordsStr('units', target, folder);
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
    console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log(util.inspect(e));
  }
}

function getSourceData(source, folder) {
  if (sysfiles.includes(source)) {
    return tut.getSysDataFile(source);
  }

  // Считать файл из проекта
  const cfilename = path.join(project_c, folder, source + '.json');
  return JSON.parse(fs.readFileSync(cfilename, 'utf8'));
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
          folder:1,
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
   const rootId = "unitgroup";
   let str =  JSON.stringify({
    _id: rootId,
    folder:1,
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
          folder:1,
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
