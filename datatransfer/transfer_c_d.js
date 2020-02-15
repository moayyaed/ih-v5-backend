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

  // TODO Если новый проект не существует, создать структуру папок
  // Папки и файлы проектов общедоступны
  process.umask(0);
  const appdir = path.join(__dirname, '../'); // Это путь к app.js
  const configdir = path.join(appdir, '../'); // Это путь к config.json в папке intrahouse-d

  // Но имя проекта будет другое, не из config!!!
  appconfig.start(appdir, configdir, folder_d);

  console.log('Start trasfer from ' + project_c + ' to ' + project_d);
  console.log('lang=' + appconfig.get('lang'));

  // transfer('classes', 'lists', 'jbase');
  // transfer('types', 'types', 'jbase');
  // transfer('places', 'lists', 'jbase');
  // transfer('rooms', 'lists', 'jbase');
  // transfer('devref', 'devices', 'jbase');
  // transfer('spaces', 'lists', 'jbase');
  // transfer('layouts', 'layouts', 'jbase');

  create('typeprops', 'jbase');
  // create('devprops', 'jbase');
  // let res = tut.createDevprops(project_d);

  rl.close();
})();

function question(str) {
  return new Promise(resolve => {
    rl.question(str, answer => {
      resolve(answer);
    });
  });
}

function transfer(source, target, folder) {
  try {
    // Считать файл
    // const cfilename = path.join(project_c, folder, source + '.json');
    // const data = JSON.parse(fs.readFileSync(cfilename, 'utf8'));
    const data = getSourceData(source, folder);

    // сформировать строку
    let str = tut.getRootItem(source);
    let order = 0;
    data.forEach(item => {
      order += 100;
      item.order = order;
      str += tut.formRecord(source, target, item);
    });

    // Записать в новый файл
    const dfilename = path.join(project_d, folder, target + '.db');

    fs.appendFileSync(dfilename, str);
    console.log(str);
    console.log('Data was appended to file' + dfilename + '. Str len=' + str.length);
  } catch (e) {
    console.log(util.inspect(e));
  }
}

function create(target, folder) {
  try {
    let str = '';
    switch (target) {
      case 'typeprops':
        str = tut.createTypeprops();
        break;

      case 'devprops':
        str = tut.createDevprops(project_d);
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

/*
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

      robj = { _id: 'd' + item.id, parent, order: item.order, dn: item.dn, name: item.dn + ' ' + item.name };
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
*/

// auxiliary - вспомогательный, добавочный, дополнительный
