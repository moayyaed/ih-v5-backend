/**
 * handlerutils.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const ROOT = 'handlergroup';

const readScript = `
module.exports = function(device, prop, value) {
  
  return value;
  // return {value:42, err:1};
  // return {};
};`;

const calculateScript = `
module.exports = function(device, prop) {
  if (prop == 'state') return device.value > 0 ? 1 :0;

};`;

const commandScript = `
module.exports = function(device) {
  device.set('value', 1);
};`;

async function syncHandlers(docs) {
  console.log('SYNC HANDLER START path=' + appconfig.getHandlerPath());
  let changeDocs;
  try {
    const folder = appconfig.getHandlerPath();
    const fileNames = await fs.promises.readdir(folder);
    const scriptNames = fileNames.filter(el => el.endsWith('.js')).map(el => el.substr(0, el.length - 3));
    console.log('SYNC HANDLER scriptNames=' + scriptNames);

    const docsObj = hut.arrayToObject(docs, '_id');

    // const promises = scriptNames.map(name => (!docsObj[name] ? createNewDocFromFile(name) : ''));

    const promises = scriptNames.map(name => getScriptFromFile(folder, name));

    const scriptArr = await Promise.all(promises); // Считать все скрипты и проверить тип

    // Если записи для файла нет - создать новую запись,
    // Название и тип - проверить, исправить если не совпадают


    // changeDocs = await Promise.all(promises);

    // Проверить, что для каждой записи таблицы есть файл в папке.
    // Если нет - пометить как отсутствующий 
    docs.forEach(doc => {
      if (!scriptNames.includes(doc._id)) {
        changeDocs.push(missingScriptFile(doc._id));
      }
    });
  } catch (e) {
    console.log('Error syncScripts ' + util.inspect(e));
  }
  console.log('SYNC HANDLER changeDocs=' + util.inspect(changeDocs));

  return changeDocs;
}

async function createNewDocFromFile(id) {
  // Считать комментарий и вытащить name и type

  return { new: 1, _id: id, status: '0', name: id, parent: ROOT };
}

async function getScriptFromFile(folder, name) {
  const filename = path.join(folder, name+'.js');
  const script = await fs.promises.readFile(filename, 'utf8');
  // Разобрать заголовок и сам файл??
  
  return {name, script};
}

function missingScriptFile(id) {
  return { _id: id, $set: { unget: 1, status: 2, err: 1, errstr: 'Script not found!' } };
}

function getNewScriptHeader(type) {
  const res = { name: 'New function', type, desc: '' };
  switch (type) {
    case 'command':
      res.name = 'New command';
      break;
    case 'calculate':
      res.name = 'New calculate function';
      break;
    default:
  }
  return res;
}

function createNewScriptFromTemplate(id, headerObj) {
  let str = `
/**
 * @name ${headerObj.name}
 * @type ${headerObj.type}
 * @desc ${headerObj.desc}
 */
${getNewScriptBody(headerObj.type)}
`;

  return createScriptFile(id, str);
}

function getNewScriptBody(type) {
  switch (type) {
    case 'command':
      return commandScript;
    case 'calculate':
      return calculateScript;
    default:
      return readScript;
  }
}

async function copyScriptFile(fromId, toId) {
  const scriptStr = await fs.promises.readFile(appconfig.getHandlerFilename(fromId), 'utf8');
  return createScriptFile(toId, scriptStr);
}

async function createScriptFile(sceneId, scriptStr) {
  return fs.promises.writeFile(appconfig.getHandlerFilename(sceneId), scriptStr, 'utf8');
}

module.exports = {
  syncHandlers,
  createNewScriptFromTemplate,
  copyScriptFile,
  getNewScriptHeader
};
