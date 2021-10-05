/**
 * handlerutil.js
 */

const util = require('util');
const fs = require('fs');
// const path = require('path');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');
const loadsys = require('../utils/loadsys');
const liststore = require('../dbs/liststore');

const defaulthandlers = require('./defaulthandlers');

function getHandlerFunction(handlerObj) {
  if (!handlerObj || (!handlerObj.name && !handlerObj.filename)) return '';

  if (!handlerObj.filename) return defaulthandlers[handlerObj.name];

  try {
    return require(handlerObj.filename);
  } catch (e) {
    console.log('ERROR: Handler ' + handlerObj.filename + ' ' + util.inspect(e));
  }
}

function getHandlerFilename(typeId, prop) {
  return appconfig.getHandlerFilenameIfExists(typeId + '_' + prop);
}

function getDefaultHandlerName(typeId, prop, typeItem) {
  const p = typeItem.props[prop];
  const mainProp =
    prop == 'toggle' ? (typeItem.props.state ? 'state' : 'value') : typeItem.props.value ? 'value' : 'state';
  return getDefHandlerName(prop, p, mainProp);
}

function getDefaultHandler(typeId, prop, typeItem) {
  const p = typeItem.props[prop];
  const mainProp =
    prop == 'toggle' ? (typeItem.props.state ? 'state' : 'value') : typeItem.props.value ? 'value' : 'state';
  const fname = getDefHandlerName(prop, p, mainProp);
  return fname ? defaulthandlers[fname] : '';
}

async function loadHandler(id) {
  const filename = appconfig.getHandlerFilename(id);
  // console.log('LOAD HANDLER ' + id + ' filename=' + filename);
  return fs.existsSync(filename) ? loadsys.loadFile(filename) : '';
}

async function getCustomHandler(table, id) {
  const str = await loadHandler(id);

  return (
    str ||
    `
  module.exports = async (holder, debug) => { 
    try {
      const data = await holder.dm.get('mytable');   
      debug('Records:'+data.length)
      return data;
    } catch (e) {
      debug(e.message)
    }
  }
  `
  );
}

async function getGlobalVarHandler(id) {
  const str = await loadHandler(id);

  return str || defaultGlobalVarHandler();
}

function defaultGlobalVarHandler() {
  return `
    /**
     * currentValue - текущее значение глобальной переменной
     * 
     * devs - объект, содержащий все устройства из списка триггеров
     *     Можно напрямую адресоваться к устройству из списка: devs.SENSOR1.state
     *     или перебирать список 
     *     В теле функции можно использовать любые свойства устройства из списка
     *     Например, триггером является свойство "error", а проверяются devs[dn].state и devs[dn].value
     * 
     * 
     * @return - Возвращаемое значение будет присвоено переменной
     */
  module.exports = function (currentValue, devs)  { 
    let res = false;
    Object.keys(devs).forEach(dn => {
      res = res || devs[dn].state; // Если хотя бы один state=1,  то значение = true
      // res = res && devs[dn].state; // Если все state=1,  то значение = true
    });
    return res ? 1 : 0;
  }
  `;
}

async function getPropHandlerStr(typeId, inprop, typeObj) {
  const prop = inprop.startsWith('_format') ? inprop.substr(8) : inprop;

  const propItem = typeObj.props[prop];
  if (inprop.startsWith('_format')) return loadOrCreate(typeId, inprop, typeObj);

  // Для данного типа нужно вернуть не реально используемую функцию, а по свойству fuse
  // Если функция с ошибкой при загрузке - она использоваться не будет, но код нужен
  let str = '';
  const handlerObj = propItem.handler;
  if (handlerObj.name) {
    str = defaulthandlers[handlerObj.name].toString() || '';
  }

  if (propItem.fuse > 1) {
    str = await loadOrCreate(typeId, prop, typeObj);
  }
  return str;
}

async function loadOrCreate(typeId, prop, typeObj) {
  let str = '';
  // Попытаться взять из файла
  let strFromFile = await loadHandler(typeId + '_' + prop);

  // Файла нет - создать новый
  if (!strFromFile) {
    const filename = appconfig.getHandlerFilename(typeId + '_' + prop);
    return createHandler(typeId, prop, typeObj, filename);
  }
  
  // Добавить module.exports, если нет, т к будет сохраняться в отдельном файле
  str = testModuleExports(strFromFile);
  return str;
}

async function createHandler(typeId, prop, typeObj, filename) {
  let str = prop.startsWith('_format')
    ? createNewFormatHandler(typeId, prop, typeObj)
    : createNewHandler(typeId, prop, typeObj);
  str = testModuleExports(str);

  // сразу записать в файл если передали имя файла
  if (filename) {
    await fut.writeFileP(filename, str);
  }
  return str;
}

async function getOnHandlerStr(typeId, propOn) {
  let str;
  // Попытаться взять из файла
  let strFromFile = await loadHandler(typeId + '_' + propOn); // t002__onChange

  // Файла нет - создать новый
  if (!strFromFile) {
    const filename = appconfig.getHandlerFilename(typeId + '_' + propOn);
    return createOnHandler(typeId, propOn, filename);
  }

  str = testModuleExports(strFromFile);
  return str;
}


async function createOnHandler(typeId, propOn, filename) {

  const def = 'def' + propOn;
  const defFun = defaulthandlers[def];
  if (!defFun || typeof defFun != 'function') throw { message: 'Not found default function ' + def };
  let str = defaulthandlers[def].toString();
  str = testModuleExports(str);
  if (filename) {
    await fut.writeFileP(filename, str);
  }
  return str;
}


function testModuleExports(str) {
  if (str.indexOf('module.exports') >= 0) return str;

  const i = str.indexOf('function');
  // if (i < 0) throw { message: 'Invalid script! Not found "function" clause!' };

  return str.substr(0, i - 1) + 'module.exports = ' + str.substr(i);
}

function getDefHandlerName(prop, typePropItem, mainProp) {
  if (typeof typePropItem != 'object') return '';
  
  const { vtype, op } = typePropItem;
  switch (op) {
    case 'rw':
    case 'par':
      return 'def_rw_' + vtype; // def_rw_N,..

    case 'cmd':
      return mainProp && (prop == 'toggle' || prop == 'on' || prop == 'off') ? 'def_cmd_' + mainProp + '_' + prop : ''; // def_cmd_state_on

    case 'calc':
      return prop == 'state' && mainProp == 'value' ? 'def_calc' : '';

    default:
      return '';
  }
}

function createNewFormatHandler(typeId, inprop, typeObj) {
  if (!inprop || !inprop.startsWith('_format')) return '';

  const prop = inprop.substr(8);
  const propItem = typeObj.props[prop];

  const desc_name = 'Функция вывода значения "' + prop + '" в виде строки';
  const desc_device = 'device - Устройство (Object)';
  const desc_prop = 'prop = "' + prop + '"';
  const desc_val = 'val - исходное значение';

  const format_def = 'format_def_' + propItem.vtype;
  let script = '';
  if (defaulthandlers[format_def]) {
    script = defaulthandlers[format_def].toString();
  }

  return `
/**
 * ${desc_name}
 * 
 *     ${desc_device}
 *     ${desc_prop}
 *     ${desc_val}
 */
 ${script}
`;
}

function createNewHandler(typeId, prop, typeObj) {
  const propItem = typeObj.props[prop];
  let desc_name = '';
  let desc_device = 'device - Устройство (Object)';
  let desc_value = '';

  // let script = propItem.fn.toString();
  let fn = getDefaultHandler(typeId, prop, typeObj);
  if (!fn) {
    let op = propItem.op || 'rw';
    fn = defaulthandlers['def_' + op];
  }
  let script = fn.toString();

  switch (propItem.op) {
    case 'cmd':
      desc_name = 'Функция, реализующая команду "' + prop + '"';
      break;
    case 'calc':
      desc_name = 'Функция вычисления значения свойства "' + prop + '"';
      break;
    default:
      desc_name = 'Функция обработки входного значения, поступившего для свойства "' + prop + '"';
      desc_value = 'value - входящее значение';
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

async function copyHandlers(propArr, from, to) {
  const promises = propArr
    .filter(prop => appconfig.getHandlerFilenameIfExists(from + '.' + prop))
    .map(prop =>
      fs.promises.copyFile(
        appconfig.getHandlerFilename(from + '.' + prop),
        appconfig.getHandlerFilename(to + '.' + prop)
      )
    );
  return Promise.all(promises);
}

function deleteHandlers(typeId) {
  if (!typeId) return;

  const str = typeId + '_';
  // Собрать файлы <typeId>_* и удалить их
  const arr = fut.readFolderSync(appconfig.getHandlerPath(), { ext: 'js' });
  arr.forEach(filename => {
    if (filename.startsWith(str)) deleteHandler(filename.split('.').shift());
  });
}

function deleteHandler(typeId_prop) {
  if (!typeId_prop) return;

  const filename = appconfig.getHandlerFilename(typeId_prop);
  hut.unrequire(filename);
  fut.delFileSync(filename);
}

/*  checkHandler
 * При изменении скрипта
 * Основная цель - проверить ошибку при загрузке
 * Возвращает объект для записи в таблицу, если возникла (или сброшена) ошибка
 *
 */
function checkHandler(typeItem, inprop) {
  const typeId = typeItem._id;
  let setObj;
  let errstr = '';

  const filename = getHandlerFilename(typeId, inprop);
  if (!filename) {
    console.log('ERROR: checkHandler. Empty filename for typeId=' + typeId + ' ' + inprop);
    return {};
  }

  // Для общих обработчиков _OnSchedule,
  if (inprop.startsWith('_On')) {
    checkOnFun();
    return setObj ? { toUpdate: { table: 'type', doc: setObj }, errstr } : {};
  }

  // Обработчики свойства - обычный и format("_format_value")
  const prop = inprop.startsWith('_format') ? inprop.substr(8) : inprop;
  const p = typeItem.props[prop];
  if (inprop.startsWith('_format')) {
    checkPropFun('fn_format', 'errstr_format');
  } else {
    checkPropFun('fn', 'errstr');
  }
  return setObj ? { toUpdate: { table: 'type', doc: setObj }, errstr } : {};

  function checkOnFun() {
    const errPropName = 'err' + inprop;
    tryIt();
    if (errstr != typeItem[errPropName]) {
      setObj = { [errPropName]: errstr };
    }
  }

  function tryIt() {
    try {
      require(filename);
    } catch (e) {
      errstr = 'Handler ERROR: ' + hut.getShortErrStr(e);
      console.log('ERROR: Handler ERROR: ' + hut.getErrStrWoTrace(e));
    }
    hut.unrequire(filename);
  }

  function checkPropFun(prop_fn, prop_err) {
    tryIt();
    // console.log('checkPropFun errstr='+errstr+' prop_fn='+prop_fn+' prop_err='+prop_err+' p[prop_err]='+util.inspect(p[prop_err]))
    if (!errstr) errstr = '';
    if (errstr != p[prop_err]) {
      // Сбросить или установить ошибку errstr в types.props
      setObj = { ['props.' + prop + '.' + prop_err]: errstr };
    }
  }
}

function getPropFromHandlerName(typeId, filename) {
  const str = hut.getFileNameExtLess(filename);
  return str.substr(typeId.length + 1);
}

function splitHandlerFilename(filename) {
  const str = hut.getFileNameExtLess(filename);
  // console.log('splitHandlerFilename ' + filename + '  str=' + str);

  const typeList = liststore.getListMap('typeList');
  let type;

  const larr = str.split('_');

  if (larr.length == 2) {
    return { type: larr[0], prop: larr[1] };
  }

  if (larr.length > 2) {
    if (typeList.has(larr[0])) {
      return { type: larr[0], prop: larr.slice(1).join('_') };
    }
    type = larr.slice(0, 2).join('_');
    if (typeList.has(type)) {
      return { type, prop: larr.slice(2).join('_') };
    }
  }

  return { type: '', prop: '' };
}

async function getVisScript(id) {
  // const filename = path.join(appconfig.get('visscriptpath'), id + '.js');
  const filename = appconfig.getVisScriptFilename(id);
  let str;
  if (fs.existsSync(filename)) {
    str = await loadsys.loadFile(filename);
  }

  return str || defaultVisScript();
}

function defaultVisScript() {
  return `
/**
* Скрипт визуализации
* Запускается при кликах с экрана клиента (Команда Скрипт визуализации)
* Первый параметр {local} содержит входную информацию:
*   local - значения всех локальных переменных системы: переданные от клиента или дефолтные
*           {level:2, mode:1, guard:0,...}
*  Второй параметр responder - объект, способный отправлять команды клиенту, вызвавшему скрипт:
*
*   responder.gotoLayout('l022') // переход на экран l022 с дефолтными настройками
*   responder.gotoLayout('l022', {  // переход на экран l022
        frame_1:{container_id:'vc002', device_id:'d0042'}, //frame_1 будет содержать  vc002, устройство-контекст d0042
        frame_2:{device_id:'d0177'} // frame_2 будет содержать дефолтный контейнер,  устройство-контекст d0177
    }) 
*
*   responder.gotoLayout(context.start_layoutid) // переход на стартовый экран пользователя 
*   Полный список команд в разделе документации Скрипты визуализации   
*/

module.exports = function ({local, context}, responder)  { 
  // if (local.level == 1) {
  //  responder.gotoLayout('l022', {frame_1: {container_id:'vc002', device_id:'d0042'}});
  // } else {
  //  responder.gotoLayout(context.start_layoutid) // переход на стартовый экран пользователя 
  // }
}
`;
}

module.exports = {
  getHandlerFunction,
  getHandlerFilename,
  getPropHandlerStr,
  getDefaultHandler,
  getDefaultHandlerName,
  createHandler,
  createOnHandler,
  copyHandlers,
  deleteHandlers,
  deleteHandler,
  getOnHandlerStr,
  getCustomHandler,
  getGlobalVarHandler,
  checkHandler,
  splitHandlerFilename,
  getPropFromHandlerName,
  defaultGlobalVarHandler,
  getVisScript
};
