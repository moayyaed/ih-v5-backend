/**
 * handlerutil.js
 */

const util = require('util');
const path = require('path');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
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

const defaulthandlers = require('./defaulthandlers');

/**
 * Загрузить обработчик из файла 
 * Если не удалось - использовать дефолтный обработчик
 * 
 * @param {String} prop 
 * @param {Object} p 
 * @param {String} mainProp 
 */
function requireHandler(typeId, prop, typeItem) {
  const p = typeItem.props[prop];
  p.fn = '';
  try {
      // Внешний обработчик
      const filename = appconfig.getHandlerFilenameIfExists(typeId+'_'+prop);
      if (filename) {
        p.fn = require(filename);
        return;
      }
    

    if (!p.fn) useDefaultHandler(typeId, prop, typeItem);
    /*
      const mainProp = typeItem.props.value ? 'value' : 'state';
      // Дефолтный обработчик, может быть привязан либо нужно его определить?
      if (!p.fname) p.fname = getDefHandlerName(prop, p, mainProp);
      if (p.fname) p.fn = defaulthandlers[p.fname];
    */
  } catch (e) {
    console.log('ERROR:  handlerutil.requireHandler for type:'+typeId+', prop:' + prop+' '+util.inspect(e)+' USE DEFAULT handler!');
    useDefaultHandler(typeId, prop, typeItem)
  }

}

function useDefaultHandler(typeId, prop, typeItem) {
  const p = typeItem.props[prop];
  const mainProp = typeItem.props.value ? 'value' : 'state';
  const fname = getDefHandlerName(prop, p, mainProp);
  p.fn = fname ? defaulthandlers[fname] : '';
}

function unrequireHandler(fname) {
  if (!isDefHandler(fname)) {
    const filename = appconfig.getHandlerFilenameIfExists(fname);
    if (filename) hut.unrequire(filename);
  }
}

function isDefHandler(fname) {
  return fname.startsWith('def_');
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

function getShowHandlersStr(props) {
  let str = '/**  В этом окне показаны функции, которые работают для свойств конкретно этого типа.\n';
  str += '*    Это может быть код по умолчанию или код функции, явно привязанной к свойству.\n';
  str += '*    Здесь функции показаны только для просмотра.\n';
  str += '*    Для замены функции выберите другую функцию из выпадающего списка в таблице свойств \n';
  str += '*    Изменить код функции или создать новую  можно в разделе Функции-обработчики\n';
  str += '*    Код функций по умолчанию (Default) изменить нельзя\n';
  str += '* \n';
  str += '*    Для свойства-значения (Value, Parameter) функция срабатывает при приеме данных\n';
  str += '*    Цель этой функции - обработка входных данных\n';
  str += '*    Если не задано, код по умолчанию зависит от типа значения (Number, Bool, String) \n';
  str += '* \n';
  str += '*    Для свойства-команды (Command) функция срабатывает при  вызове команды \n';
  str += '*    Цель в этом случае - реализация команды через изменение связанного состояния\n';
  str +=
    '*    Для команд on,off по умолчанию выполняется функция, реализующая команду через запись в свойство "value" \n';
  str += '*    Если свойство "value" привязано к каналу, произойдет запись в канал.\n';
  str += '*    Если свойство "value" виртуальное, сразу произойдет переключение состояния.\n';
  str += '*    toggle команда по умолчанию выполняется через вызов команд on/off  \n';
  str += '* \n';
  str += '*    Если свойство-команда привязана к каналу напрямую, то функция не запускается \n';
  str += '*    Ожидается, что изменение связанного состояния произойдет штатно при опрации чтении  \n';
  str += '*    В некоторых случаях (медленное устройство, нет обратной связи) требуется другое поведение: \n';
  str += '*    вместе с отправкой команды сразу выполнить переключение связанного свойства  \n';
  str += '*    Это можно сделать на уровне конкретного устройства (не типа)\n';
  str +=
    '*    Если свойство имеет привязку к каналу для записи, становится доступным флаг Односторонняя связь?? (Force write???) \n';
  str += '*    При установке флага команда отправляется и сразу выполняется переключение состояния \n';
  str +=
    '*    Этот флаг можно использовать не только для команды, но и для обычного свойства с возможностью записи в канал\n';
  str += '* \n';
  str += '*    Для вычисляемого свойства (Calculated) функции по умолчанию не существует\n';
  str += '*    Смысл вычисляемого свойства - вычислить значение на базе значений других свойств\n';
  str += '*    Если функция не назначена - значение никогда не изменится\n';
  str += '*    Запускать функцию можно:\n';
  str += '*     - При изменении значений других свойств устройства (всех или ввести список свойств через запятую) \n';
  str += '*       Это опция по умолчанию\n';
  str += '*     - При любом поступлении значений других свойств устройства, даже если изменений нет \n';
  str += '*     - Периодически по таймеру\n';
  str +=
    '*    Кроме этого, функция для вычисляемого свойства  может вернуть время (интервал или временную точку) для следующего запуска\n';
  str += '*/\n\n';

  Object.keys(props).forEach(prop => {
    if (props[prop].fn) {
      const module = props[prop].fname || 'Default';
      str += '/** Свойство: ' + prop + ',  module: ' + module + ' **/\n' + props[prop].fn.toString() + '\n\n';
    }
  });
  return str;
}

/**
 * Синхронизация скриптов в папке handlers и таблицы handlers
 * Таблица хранит информацию о скриптах:
 *    {"_id":"fun22","name":" Состояние методом интервалов","type":" calculate","parent":"fng002","order":2500}
 *
 * @param {Array of Objects} docs - документы из таблицы handlers
 * @return {Array of Objects} changeDocs - массив изменений для записи в таблицу
 *        Новые записи и изменения вместе: [{new:1, doc:{_id,name...}}, {doc:{_id, name, $set:{}...}}]
 */
async function syncHandlers(docs) {
  const changeDocs = [];
  try {
    const folder = appconfig.getHandlerPath();
    const fileNames = await fut.readdirP(folder);
    const scriptNames = fileNames.filter(el => el.endsWith('.js')).map(el => el.substr(0, el.length - 3));

    const docsObj = hut.arrayToObject(docs, '_id');

    //  _id - имя файла без расширения
    const promises = scriptNames.map(_id => getScriptFromFile(folder, _id));

    // Считать все скрипты. scriptArr = [{_id, str},..]
    const scriptArr = await Promise.all(promises);

    // Вычислить max order
    let order = 0;
    docs.forEach(item => {
      if (item && item.order && item.order > order) order = item.order;
    });

    // Если записи для файла нет - создать новую запись
    // Если запись есть - проверить название и тип, исправить если не совпадают
    scriptArr.forEach(item => {
      const _id = item._id;
      // const changeDoc = !docsObj[_id] ? createNewDoc(_id, item.str, order) : verifyDoc(_id, item.str, docsObj[_id]);
      let changeDoc;
      if (!docsObj[_id]) {
        order += 1000;
        changeDoc = createNewDoc(_id, item.str, order);
      } else {
        changeDoc = verifyDoc(_id, item.str, docsObj[_id]);
      }
      if (changeDoc) changeDocs.push(changeDoc);
    });

    // Проверить, что для каждой записи таблицы есть файл в папке.
    // Если нет - установить ошибку
    // Отсутствующий обработчик не должен браться в droplist, не должен привязываться?
    docs.forEach(doc => {
      if (!scriptNames.includes(doc._id)) {
        changeDocs.push(missingScriptFile(doc._id, doc));
      }
    });
  } catch (e) {
    console.log('ERROR:  handlerutil.syncScripts ' + util.inspect(e));
  }
  console.log('SYNC HANDLER changeDocs=' + util.inspect(changeDocs));
  return changeDocs;
}

function createNewDoc(_id, str, order) {
  const item = handlerStrToObj(_id, str);
  return { new: 1, doc: { parent: ROOT, order, ...item } };
}

function verifyDoc(_id, str, olddoc) {
  const item = handlerStrToObj(_id, str);
  if (olddoc.name != item.name) setUpdated(olddoc, 'name', item.name);
  if (olddoc.type != item.type) setUpdated(olddoc, 'type', item.type);

  // Сброс ошибки, если файл есть
  if (olddoc.err || olddoc.errstr) {
    setUpdated(olddoc, 'err', 0);
    setUpdated(olddoc, 'errstr', '');
  }
  return olddoc.$set ? { doc: olddoc } : '';
}

function setUpdated(olddoc, prop, val) {
  if (!olddoc.$set) olddoc.$set = {};
  olddoc.$set[prop] = val;
}

function missingScriptFile(id, olddoc) {
  setUpdated(olddoc, 'err', 1);
  setUpdated(olddoc, 'errstr', 'Script not found!');
  return { doc: olddoc };
  // return { _id: id, $set: { err: 1, errstr: 'Script not found!' } };
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

async function createScriptFile(sceneId, scriptStr) {
  return fut.writeFileP(appconfig.getHandlerFilename(sceneId), scriptStr);
}

async function getScriptFromFile(folder, _id) {
  const filename = path.join(folder, _id + '.js');
  const str = await fut.readFileP(filename);
  return { _id, str };
}

function handlerStrToObj(_id, str) {
  // Разобрать заголовок и сам файл??
  // const { comment, script } = splitCommentAndScript(str);
  const { comment } = splitCommentAndScript(str);
  const { name, type } = extractCommentFields(comment); // Лишнее не брать - только name, type
  return { _id, name, type };
}

/**
 * Выделить в скрипте комментарий и непосредственно сам скрипт (module.exports)
 *
 */
function splitCommentAndScript(astr) {
  // Файл должен начинаться с обязательного комментария /* */, из него берется описание
  // Все, что выше первого комментария, игнорируется
  let str = astr;
  let comment = '';
  let scriptstr = '';
  let j;
  try {
    j = str.indexOf('*/');
    if (j >= 0) {
      comment = hut.allTrim(str.substr(0, j - 1)); // */ не нужен
      str = hut.allTrim(str.substr(j + 2));
    }

    j = str.search(/module.exports\s*=\s*function/);
    if (j >= 0) {
      scriptstr = str.substr(j);
    }
  } catch (e) {
    console.log(
      'ERROR ' + util.inspect(e) + ' input:' + astr + ' J=' + j + ' typeof str=' + typeof str + util.inspect(str)
    );
  }

  return { comment, scriptstr };
}

function extractCommentFields(comment) {
  const result = {};
  const regexp = /(@[^\s]*)/; // Выделить все символы после  @ до пробела
  if (comment) {
    comment.split('\n').forEach(str => {
      let arrx = regexp.exec(str);
      if (arrx && arrx[0] && arrx.index) {
        const field = arrx[0].substr(1);
        if (field) {
          const val = str.substr(arrx.index + field.length + 1);
          result[field] = hut.allTrim(val);
        }
      }
    });
  }
  return result;
}

module.exports = {
  useDefaultHandler,
  requireHandler,
  unrequireHandler,
  getShowHandlersStr,

  syncHandlers,
  createNewScriptFromTemplate,
  getNewScriptHeader,
  handlerStrToObj,
  createNewDoc,
  verifyDoc
};
