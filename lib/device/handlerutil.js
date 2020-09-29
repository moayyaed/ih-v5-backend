/**
 * handlerutil.js
 */

// const util = require('util');

// const hut = require('../utils/hut');
// const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');
const loadsys = require('../utils/loadsys');

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

const defaulthandlers = require('./defaulthandlers');

function getHandlerFilename(typeId, prop) {
  return appconfig.getHandlerFilenameIfExists(typeId + '_' + prop);
}

function getDefaultHandler(typeId, prop, typeItem) {
  const p = typeItem.props[prop];
  const mainProp = typeItem.props.value ? 'value' : 'state';
  const fname = getDefHandlerName(prop, p, mainProp);
  return fname ? defaulthandlers[fname] : '';
}

async function getHandlerStr(typeId, prop, typeObj) {
  const propItem = typeObj.props[prop];
  // Для данного типа нужно вернуть не реально используемую функцию, а по свойству fuse
  // Если функция с ошибкой при загрузке - она использоваться не будет, но код нужен
  let str = propItem.fn.toString();

  if (propItem.fuse > 1) {
    // Попытаться взять из файла
    let strFromFile = await loadsys.loadHandler(typeId + '_' + prop);

    // Файла нет - создать новый
    if (!strFromFile) strFromFile = createNewHandler(typeId, prop, typeObj);
    if (strFromFile) str = strFromFile;

    // Добавить module.exports, если нет, т к будет сохраняться в отдельном файле
    str = testModuleExports(str);
  }
  return str;
}

function testModuleExports(str) {
  if (str.indexOf('module.exports') >= 0) return str;

  const i = str.indexOf('function');
  // if (i < 0) throw { message: 'Invalid script! Not found "function" clause!' };

  return str.substr(0, i - 1) + 'module.exports = ' + str.substr(i);
}

function getDefHandlerName(prop, { vtype, op }, mainProp) {
  switch (op) {
    case 'rw':
    case 'par':
      return 'def_rw_' + vtype; // def_rw_N,..

    case 'cmd':
      return mainProp && (prop == 'toggle' || prop == 'on' || prop == 'off') ? 'def_cmd_' + mainProp + '_' + prop : ''; // def_cmd_state_on

    default:
      return '';
  }
}

function createNewHandler(typeId, prop, typeObj) {
  const propItem = typeObj.props[prop];
  let desc_name = '';
  let desc_device = 'device - Устройство (Object)';
  let desc_value = '';
  // let script = propItem.fn.toString();
  let script = getDefaultHandler(typeId, prop, typeObj).toString();

  switch (propItem.op) {
    case 'cmd':
      desc_name = 'Функция, реализующая команду "' + prop+'"';
      // script = commandScript;
      break;
    case 'calc':
      desc_name = 'Функция вычисления значения свойства "' + prop + '"';
      // script = calculateScript;
      break;
    default:
      desc_name = 'Функция обработки входного значения, поступившего для свойства "' + prop + '"';
      desc_value = 'value - входящее значение';
      // script = readScript;
  }

  return `
/**
 * ${desc_name}
 * 
 *     ${desc_device}
 *     ${desc_value}
 */
 ${script}
`;
}

module.exports = {
  getHandlerFilename,
  getHandlerStr,
  getDefaultHandler
};
