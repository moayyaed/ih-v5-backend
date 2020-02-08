/**
 * CLI module for project transfer
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let project_c;
let project_d;

(async () => {
  project_c = await question('Папка или полный путь к проекту v4 (C): ');
  project_d = await question('Папка или полный путь к проекту v5 (D): ');

  // TODO - могли задать полный путь!
  project_c = path.join('/var/lib/intrahouse-c/projects', project_c);
  project_d = path.join('/var/lib/intrahouse-d/projects/', project_d);

  console.log('Start trasfer from ' + project_c + ' to ' + project_d);

  // TODO Если новый проект не существует, создать структуру папок

  // TODO Если файлы данных не существуют, создать и заполнить начальными значениями

  // transfer('places', 'lists', 'jbase');
  // transfer('rooms', 'lists', 'jbase');
  transfer('devref', 'devices', 'jbase');

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
    const cfilename = path.join(project_c, folder, source + '.json');
    const data = JSON.parse(fs.readFileSync(cfilename, 'utf8'));

    // сформировать строку
    let str = getRootItem(source);
    let order = 0;
    data.forEach(item => {
      order += 100;
      item.order = order;
      str += formRecord(source, target, item);
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

function getRootItem(source) {
  let robj = {};
  switch (source) {
    case 'places':
      robj = { _id: 'place', list: 'place', parent: 0, order: 0, name: 'All ' + source };
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
        parent = 'p' + item.place + (item.room ? 'r'+item.room :'') ;
      } else parent = 'place';
     
      robj = {_id: 'd' + item.id, parent, order: item.order, dn: item.dn, name: item.dn +' '+item.name};
      break;

    default:
      robj = '';
      console.log('Not found source ' + source);
  }
  return robj ? JSON.stringify(robj) + '\n' : '';
}
