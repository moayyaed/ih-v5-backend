/**
 *  hut.js - служебные утилиты
 */

const util = require('util');
const fs = require('fs');
const pathUtil = require('path');

var deepEqualNode = require('deep-equal');

const sysloglevels = ['  ERR', ' WARN', ' INFO', 'DEBUG', 'TRACE'];

/*
 * Строковые функции
 *  @param str {string}
 *  @return {string}
 **/
exports.allTrim = allTrim;
exports.firstToUpper = firstToUpper;
exports.isValSatisfyToFilter = isValSatisfyToFilter;
exports.removeBorderQuotes = removeBorderQuotes;
exports.getFirstWords = getFirstWords;
exports.getLastWord = getLastWord;
exports.isOper = isOper;
exports.intersection = intersection;
exports.extractNumFromStr = extractNumFromStr;
exports.removeLastNumFromStr = removeLastNumFromStr;
exports.getFileExt = getFileExt;
exports.getFileNameExtLess = getFileNameExtLess;
exports.getFileNameFromPathName = getFileNameFromPathName;
exports.getPathFirstName = getPathFirstName;
exports.getPathLastName = getPathLastName;

exports.isTheSameDate = isTheSameDate;
exports.isNextDateLater = isNextDateLater;
exports.isTheSameArray = isTheSameArray;
exports.pad = pad;
exports.isIdValid = isIdValid;
exports.substitude = substitude;

/**
 *  Обработка объектов
 */
exports.isObjIdle = isObjIdle;
exports.addSuffToPropNames = addSuffToPropNames;
exports.deletePropsWithSuff = deletePropsWithSuff;
exports.isInFilter = isInFilter;
exports.isValSatisfyToFilter = isValSatisfyToFilter;
exports.clone = clone;
exports.extend = extend;
exports.removeProps = removeProps;
exports.formOneObj = formOneObj;
exports.formArrayReplay = formArrayReplay;
exports.locateFirstRecord = locateFirstRecord;

exports.objMustHaveProps = objMustHaveProps;
exports.arrayToObject = arrayToObject;
exports.arrayToObjectByProp = arrayToObjectByProp;
exports.arrayToDict = arrayToDict;

exports.objectToArray = objectToArray;
exports.fillRelFields = fillRelFields;
exports.deepEqual = deepEqual;

exports.getLogMsg = getLogMsg;
exports.logMsg = logMsg;
exports.logWarn = logWarn;
exports.logErr = logErr;

exports.getDateTimeFor = getDateTimeFor;

exports.checkFolder = checkFolder;
exports.checkAndMakeFolder = checkAndMakeFolder;
exports.removeFolderSync = removeFolderSync;
exports.getInnerFoldersSync = getInnerFoldersSync;
exports.readDirSync = readDirSync;

exports.readJsonFileSync = readJsonFileSync;
exports.writeJsonFileSync = writeJsonFileSync;
exports.copySync = copySync;
exports.writeJsonFile = writeJsonFile;
exports.writeValToJsonFileSilent = writeValToJsonFileSilent;
exports.isImgFile = isImgFile;
exports.getModifyTime = getModifyTime;
exports.getModifyTimeMs = getModifyTimeMs;
exports.calcNewKey = calcNewKey;
exports.calcNewId = calcNewId;
exports.byorder = byorder;
exports.revise = revise;

exports.checkFileAndChangeModeSync = checkFileAndChangeModeSync;
exports.getArch = getArch;

exports.delFolderSync = delFolderSync;
exports.delFileSync = delFileSync;

exports.getCmdErrObj = getCmdErrObj;
exports.shortenErrResponse = shortenErrResponse;
exports.timeFormat = timeFormat;

exports.unrequire = unrequire;
exports.isStringMatch = isStringMatch;
exports.evaluateObj = evaluateObj;

exports.getSecInterval = getSecInterval;
exports.getFormattedValue = getFormattedValue;

/**
 *  Удаление space-символов (пробел, табуляция, новая строка) в начале и конце строки.
 *  [\s] -  то же что и [\n\t\r\f]
 */
function allTrim(str) {
  return str && typeof str === 'string' ? str.replace(/^\s+/, '').replace(/\s+$/, '') : '';
}

/**
 * Перевод первого символа строки в верхний регистр
 */
function firstToUpper(str) {
  return str && typeof str === 'string' ? str.substr(0, 1).toUpperCase() + str.substr(1) : '';
}

/**
 * Удаление символов двойных кавычек, окружающих строку.
 * Пробельные символы до и после кавычек также удаляются
 *  Если начальной кавычки нет - удаляются только пробелы
 */
function removeBorderQuotes(str) {
  let result = allTrim(str);
  return result && result.substr(0, 1) === '"' ? result.substr(1, result.length - 2) : result;
}

/**
 * Возвращает первые  qwords слов в строке как строку
 * Несколько пробельных символов заменяется одним пробелом. Начальные пробельные символы очищаются
 */
function getFirstWords(astr, qwords) {
  let str = allTrim(astr);
  let n = Number(qwords) > 0 ? Number(qwords) : 1;
  return str
    ? str
        .split(/\s+/)
        .slice(0, n)
        .join(' ')
    : '';
}

/** Возвращает последнее слово в строке.
 *  Символы-разделители в конце строке отсекаются
 */
function getLastWord(astr) {
  let str = allTrim(astr);
  return str
    ? str
        .split(/\s+/)
        .slice(-1)
        .join('')
    : '';
}

/** Возвращает true, если строка - это символ операции: =, >, <  **/
function isOper(astr) {
  let str = allTrim(astr);
  return str.length === 1 && /[<>=]/.test(str.charAt(0));
}

/** Пересечение двух csv-строк (списки имен, идентификаторов через запятую)
 * list1, list2 - csv -строки
 * Возвращает csv -строка пересечения
 */
function intersection(list1, list2) {
  let arr1;
  let arr2;
  let arr3;

  if (list1 && list2) {
    arr1 = allTrim(list1).split(',');
    arr2 = allTrim(list2).split(',');
    arr3 = arr1.filter(item1 => arr2.some(item2 => item1 === item2));
  }
  return arr3 ? arr3.join(',') : '';
}

/** Выделяет в строке первые числовые символы идущие подряд
 *   (H_102_1 =>102)
 **/
function extractNumFromStr(str) {
  let rar = str && typeof str == 'string' ? /\d+/.exec(str) : '';
  return rar && rar.length > 0 ? rar[0] : '';
}

function removeLastNumFromStr(str) {
  if (typeof str != 'string') return str;

  let res = str.match(/\d+$/);
  return res && res.index && res.index > 0 ? str.substr(0, res.index) : str;
}

function getFileExt(filename) {
  let parts = filename
    .split('/')
    .pop()
    .split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function getFileNameFromPathName(fullname) {
  return fullname
    .split('\\')
    .pop()
    .split('/')
    .pop();
}

function getFileNameExtLess(fullname) {
  let filename = getFileNameFromPathName(fullname);
  return filename.split('.').shift();
}

function getPathFirstName(path) {
  return path.indexOf('/') > 0 ? path.split('/').shift() : path;
}

function getPathLastName(path) {
  return path.indexOf('/') > 0 ? path.split('/').pop() : path;
}

function substitude(template, obj, callback) {
  let result = template;
  if (!result) return '';

  while (result.indexOf('{') >= 0) {
    let i = result.indexOf('{');
    let j = result.indexOf('}');
    if (j > i) {
      result = result.substr(0, i) + oneReplace(result.substring(i + 1, j)) + result.substr(j + 1);
    } else break;
  }
  return result;

  function oneReplace(str) {
    if (callback) {
      return callback(obj, str);
    }
    return obj[str] != undefined ? String(obj[str]) : '';
  }
}

/** *********** Обработка объектов  ***************** **/

/** Проверка, что объект нерабочий
 *  @param  obj {Object} - проверяемый объект
 *  @return true - если НЕ объект или объект пуст
 */
function isObjIdle(obj) {
  return typeof obj !== 'object' || Object.keys(obj).length <= 0;
}

/** Добавить к каждому НАЗВАНИЮ объекта суффикс
 * @param  {Object} obj
 * @param  {String} suff
 * @return {Object} - новый объект с переименованными свойствами
 */
function addSuffToPropNames(obj, suff) {
  let result = {};
  suff = suff || '_';
  Object.keys(obj).forEach(prop => {
    result[prop + suff] = obj[prop];
  });
  return result;
}

/** Удалить свойства объекта с заданным суффиксом
 *
 * @param {Object} obj
 * @param {String} suff
 * @return {Object} - входящий объект с удаленными свойствами
 */
function deletePropsWithSuff(obj, suff) {
  Object.keys(obj).forEach(prop => {
    if (prop.endsWith(suff)) {
      delete obj[prop];
    }
  });
  return obj;
}

/** isInFilter - проверка условий фильтра для объекта
 * @param indata {Object} - проверяемый объект
 * @param filter {Object} - фильтр
 * @return true, если условия фильтра удовлетворяются
 *
 * Значения свойств проверяемого объекта - числовые и строковые.
 * Значения должны полностью совпадать с учетом преобразования типа
 *         (нестрогое равенство: '1'=>1)
 * Преобразование регистра для строковых значений не выполняется.
 *
 * Если фильтр пуст, то TRUE
 * Если объект пуст, то FALSE, независимо от фильтра
 *   Если проверяемый объект не имеет свойства, включенного в фильтр, то FALSE
 *
 * В качестве значений фильтра м.б. набор значений: массив или строка со значениями через запятую
 *   В этом случае проверяется вхождение в этот набор.
 *   Проверку значений выполняет isValSatisfyToFilter
 *   При нахождении несовпадений - сразу выход
 */
function isInFilter(indata, filter) {
  if (!indata || isObjIdle(indata)) return false;
  if (!filter || isObjIdle(filter)) return true;

  return !Object.keys(filter).some(fi => indata[fi] === undefined || !isValSatisfyToFilter(indata[fi], filter[fi]));
}

/** isValSatisfyToFilter - проверка, что значение val удовлетворяет фильтру
 * @param val       {Number||String}  - проверяемое значение
 * @param filterVal {Number||String||Array} - фильтр.
 *                  Может быть список в виде массива или строка через запятую.
 *
 * @return true, если условия фильтра удовлетворяются
 */
function isValSatisfyToFilter(val, filterVal) {
  switch (typeof filterVal) {
    case 'number':
      return filterVal === Number(val);

    case 'string':
      // Пустой строковый фильтр игнорируется
      if (filterVal === '') {
        return true;
      }
      // сначала проверим полное совпадение, и тогда строка даже может вкл. запятую
      if (filterVal === String(val)) {
        return true;
      }
      // здесь м.б. набор параметров через запятую, преобразуем в массив
      if (filterVal.indexOf(',') >= 0) {
        return filterVal.split(',').some(elem => elem == val);
      }
      break;

    case 'object':
      if (util.isArray(filterVal)) {
        return filterVal.some(elem => elem == val);
      }
      break;
    default:
      return false;
  }
}

/** 
*  Полное (а не поверхностное) копирование объекта 
*   parent - исходный объект или массив
*   child  - результирующий - может быть undefined - тогда создается заново
*   mixin  - true:добавляются только отстутствующие свойства
*            false: все совпадающие свойства будут перезаписаны

*   return  child
*/
function clone(parent, child, mixin) {
  if (typeof parent != 'object') return parent;

  child = child || (util.isArray(parent) ? [] : {});
  if (parent) {
    Object.keys(parent).forEach(prop => {
      if (!mixin || child[prop] == undefined) {
        if (parent[prop] === null) {
          child[prop] = 0;
        } else if (typeof parent[prop] === 'object') {
          child[prop] = util.isArray(parent[prop]) ? [] : {};
          clone(parent[prop], child[prop]);
        } else {
          child[prop] = parent[prop];
        }
      }
    });
  }
  return child;
}

function extend(main, toadd) {
  return clone(toadd, main, true);
}

function removeProps(mainObj, toremove) {
  if (!mainObj || typeof mainObj != 'object') return;
  if (!toremove || typeof toremove != 'object') return;

  Object.keys(toremove).forEach(prop => {
    delete mainObj[prop];
  });
}

/*
 * Формирование одного объекта по списку полей
 *  @param {Object} dataItem - строка таблицы
 *  @param {Array} fieldlist - Список запрашиваемых полей
 *  @param all - если список полей определен, включить все поля в запись, даже если их нет в dataItem
 *  @return
 */

function formOneObj(dataItem, fieldlist, all = true) {
  let newo = {};

  if (fieldlist && typeof fieldlist == 'string') {
    fieldlist = fieldlist.split(',');
  }

  // если есть список полей - берем по списку, иначе берем как есть
  if (fieldlist && util.isArray(fieldlist) && fieldlist.length > 0) {
    fieldlist.forEach(field => {
      if (dataItem[field] != undefined) {
        newo[field] = clone(dataItem[field], newo[field]);
      } else if (all) {
        newo[field] = '';
      }
    });
  } else {
    newo = clone(dataItem);
  }
  return newo;
}

/**
 *  Формирование массива из  массива данных
 *  формируем элемент массива по списку полей или возвращаем все поля
 */
function formArrayReplay(indata, filter, fieldlist) {
  indata = indata || [];
  return !filter && !fieldlist
    ? clone(indata)
    : indata.filter(item => isInFilter(item, filter)).map(item => formOneObj(item, fieldlist));
}

/**
 *  Поиск первой записи в массиве данных по фильтру
 *  формируем элемент массива по списку полей или возвращаем все поля
 */
function locateFirstRecord(indata, filter, fieldlist) {
  if (!indata || !util.isArray(indata)) return;
  for (let i = 0; i < indata.length; i++) {
    if (isInFilter(indata[i], filter)) return formOneObj(indata[i], fieldlist);
  }
}

/**
 * Функция проверяет, что объект имеет заданные свойства.
 * Если нет - возбуждает исключение
 * Если входной параметр не объект, или строка не задана - ничего не делает
 *
 * @param {*} obj
 * @param {*} proplist
 */
function objMustHaveProps(obj, proplist) {
  if (typeof obj !== 'object' || typeof proplist !== 'string') return;

  proplist.split(',').forEach(prop => {
    if (obj[prop] == undefined) throw { message: `Missing ${prop}` };
  });
}

/**
 * Преобразует массив в объект.
 * В качестве ключа выносится свойство id
 * @param {*} data - входной массив
 */
function arrayToObject(data) {
  let result = data;
  let id;

  if (util.isArray(data)) {
    result = {};
    data.forEach(item => {
      if (item.id != undefined) {
        id = String(item.id);

        result[id] = clone(item);
        delete result[id].id;
      }
    });
  }
  return result;
}

/**
 * Преобразует массив в объект.
 * В качестве ключа выносится свойство pop
 * Если prop undefined - объект не включается
 * @param {*} data - входной массив
 */
function arrayToObjectByProp(data, prop) {
  let result = data;
  let id;

  if (util.isArray(data)) {
    result = {};
    data.forEach(item => {
      if (item[prop] != undefined) {
        id = String(item[prop]);
        result[id] = clone(item);
      }
    });
  }
  return result;
}

/**
 * Формирует из массива словарь (ключ-значение)
 * В качестве ключа выносится свойство keyprop
 * @param {*} data - входной массив
 */
function arrayToDict(data, keyprop, valprop) {
  let result = {};

  if (util.isArray(data)) {
    data.forEach(item => {
      if (item[keyprop] != undefined) {
        result[String(item[keyprop])] = item[valprop] || '';
      }
    });
  }
  return result;
}

/**
 * Преобразует объект в массив
 * Ключ включается в элемент массива с именем свойства id
 * @param {*} data
 */
function objectToArray(data) {
  let result = data;

  if (typeof data === 'object' && !util.isArray(data)) {
    result = [];
    Object.keys(data).forEach(prop => {
      result.push(Object.assign({ id: prop }, data[prop]));
    });
  }
  return result;
}

function fillRelFields(data, fields, lists) {
  if (!data || !fields || !lists) return;
  let keys = [];
  let olists = {};

  if (typeof fields !== 'object') return;

  if (!util.isArray(fields)) fields = [fields];

  fields.forEach(keyitem => {
    if (typeof keyitem === 'string') {
      keys.push({ key: keyitem, relfield: 'name', resfield: keyitem });
    } else if (keyitem.key) {
      keys.push({
        key: keyitem.key,
        relfield: keyitem.relfield || 'name',
        resfield: keyitem.resfield || keyitem.key
      });
    }
  });

  Object.keys(lists).forEach(listname => {
    if (util.isArray(lists[listname])) {
      olists[listname] = arrayToObject(lists[listname]);
    } else {
      olists[listname] = lists[listname];
    }
  });

  data.forEach(item => {
    keys.forEach(keyitem => {
      let id = item[keyitem.key];
      if (id) {
        item[keyitem.resfield] = olists[keyitem.key][id] !== undefined ? olists[keyitem.key][id][keyitem.relfield] : '';
      }
    });
  });
}

/** Функция сортировки используется в качестве вызываемой функции для сортировки массива ОБЪЕКТОВ
 *   arr.sort(hut.byorder('place,room','D')
 *    @param {String}  ordernames - имена полей для сортировки через запятую
 *    @param {*}   direction: D-descending
 *
 * Возвращает функцию сравнения
 **/
function byorder(ordernames, direction, parsingInt) {
  var arrForSort = [];
  var dirflag = direction == 'D' ? -1 : 1; // ascending = 1, descending = -1;

  if (ordernames && typeof ordernames == 'string') arrForSort = ordernames.split(',');

  return function(o, p) {
    if (typeof o != 'object' || typeof p != 'object') return 0;
    if (arrForSort.length == 0) return 0;

    for (var i = 0; i < arrForSort.length; i++) {
      let a;
      let b;
      let name = arrForSort[i];

      a = o[name];
      b = p[name];
      if (a != b) {
        if (parsingInt) {
          let astr = String(a);
          let bstr = String(b);
          if (!isNaN(parseInt(astr, 10)) && !isNaN(parseInt(bstr, 10))) {
            return parseInt(astr, 10) < parseInt(bstr, 10) ? -1 * dirflag : 1 * dirflag;
          }
        }

        // сравним как числа
        if (!isNaN(Number(a)) && !isNaN(Number(b))) {
          return Number(a) < Number(b) ? -1 * dirflag : 1 * dirflag;
        }

        // одинаковый тип, не числа
        if (typeof a === typeof b) {
          return a < b ? -1 * dirflag : 1 * dirflag;
        }

        return typeof a < typeof b ? -1 * dirflag : 1 * dirflag;
      }
    }
    return 0;
  };
}

function getLogMsg(str, level, module) {
  if (level === undefined || level >= sysloglevels.length || level < 0) level = 2;
  module = module || '';
  return sysloglevels[level] + ': ' + module + ' ' + str;
}

// Логирование ошибки - ERR
function logErr(e, message, moduleLogName) {
  console.log(getLogMsg((e ? e.message : '') + ' ' + (message || ''), 0, moduleLogName));
}

// предупреждения
function logWarn(msg, moduleLogName) {
  console.log(getLogMsg(msg, 1, moduleLogName));
}

// информационные сообщения
function logMsg(msg, moduleLogName) {
  console.log(getLogMsg(msg, 2, moduleLogName));
}

/**  Дата [время] в виде строки  заданного формата **/
function getDateTimeFor(dt, format) {
  switch (format) {
    case 'dailyname': // YYMMDD
      return String(dt.getFullYear() - 2000) + pad(dt.getMonth() + 1) + pad(dt.getDate());

    case 'monthname': // YYMM
      return String(dt.getFullYear() - 2000) + pad(dt.getMonth() + 1);

    case 'logname': // YYYYMMDD
      return String(dt.getFullYear()) + pad(dt.getMonth() + 1) + pad(dt.getDate());

    case 'id': // YYMMDDHHMMSSMMMM
      return (
        String(dt.getFullYear() - 2000) +
        pad(dt.getMonth() + 1) +
        pad(dt.getDate()) +
        pad(dt.getHours()) +
        pad(dt.getMinutes()) +
        pad(dt.getSeconds()) +
        pad(dt.getMilliseconds(), 3)
      );

    case 'trendid': // YYMMDDHHMMSS
      return (
        String(dt.getFullYear() - 2000) +
        pad(dt.getMonth() + 1) +
        pad(dt.getDate()) +
        pad(dt.getHours()) +
        pad(dt.getMinutes()) +
        pad(dt.getSeconds())
      );

    case 'shortdt': // DD.MM HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds())
      );

    case 'onlytime': // HH.MM.SS
      return pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds());
    case 'shortdtms': // DD.MM HH:MM:SS.mmm
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds()) +
        '.' +
        pad(dt.getMilliseconds(), 3)
      );

    case 'reportdt': // DD.MM.YYYY HH.MM
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes())
      );

    case 'reportd': // DD.MM.YYYY
      return pad(dt.getDate()) + '.' + pad(dt.getMonth() + 1) + '.' + dt.getFullYear();

    default:
      // DD.MM.YYYY HH.MM.SS
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        dt.getFullYear() +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds())
      );
  }
}

function pad(val, width) {
  let numAsString = val + '';
  width = width || 2;
  while (numAsString.length < width) {
    numAsString = '0' + numAsString;
  }
  return numAsString;
}

function isTheSameDate(dt1, dt2) {
  if (typeof dt1 == 'number') {
    dt1 = new Date(dt1);
  }
  if (typeof dt2 == 'number') {
    dt2 = new Date(dt2);
  }

  return (
    dt1 instanceof Date &&
    dt2 instanceof Date &&
    dt1.getFullYear() == dt2.getFullYear() &&
    dt1.getMonth() == dt2.getMonth() &&
    dt1.getDate() == dt2.getDate()
  );
}

function isNextDateLater(dt1, dt2) {
  if (dt1 instanceof Date && dt2 instanceof Date) {
    return !isTheSameDate(dt1, dt2) && dt1.getTime() < dt2.getTime();
  }
}

function isTheSameArray(ar1, ar2) {
  if (!ar1 || !util.isArray(ar1) || !ar2 || !util.isArray(ar2) || ar1.length != ar2.length) return false;

  if (ar1.length == 0) return true; // пустые совпадают

  let arr = ar2.map(elem => elem);
  ar1.forEach(elem => {
    let idx = arr.indexOf(elem);
    if (idx < 0) return false;
    arr.splice(idx, 1);
  });
  return true;
}

/** Идентификатор может содержать только лат буквы, цифры и подчеркивание
 * Первый символ д.б. не цифра
 */
function isIdValid(str) {
  return /^[a-zA-Z_]/.test(str) && !/[^a-zA-Z0-9_]/.test(str);
}

/**
 * Синхронные функции чтения и записи. Возбуждают исключение при ошибке!
 * @param {*} filename
 */

function checkAndMakeFolder(folder) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }
  return folder;
}

function checkFolder(folder) {
  if (!fs.existsSync(folder)) throw { message: `Folder not found: ${folder}` };
}

function removeFolderSync(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(file => {
      let f = path + '/' + file;
      let stats = fs.lstatSync(f);
      if (stats.isDirectory(f)) {
        removeFolderSync(f);
      } else {
        fs.unlinkSync(f);
      }
    });
    fs.rmdirSync(path);
  }
}

function readJsonFileSync(filename, nothrow) {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    if (!nothrow) throw { message: 'readJsonFileSync:' + filename + '. ' + e.message };
    console.log('WARN: Reading ' + filename + '. ' + e.message);
    return {};
  }
}

function writeJsonFileSync(filename, data, nothrow) {
  try {
    data = JSON.stringify(data);
    fs.writeFileSync(filename, data, 'utf8');
  } catch (e) {
    if (!nothrow) throw { message: 'writeJsonFileSync:' + filename + '. ' + e.message };
    console.log('ERR: Writing ' + filename + '. ' + e.message);
  }
}

function copySync(src, dest) {
  if (fs.existsSync(src)) {
    let stats = fs.statSync(src);

    if (stats.isDirectory()) {
      fs.mkdirSync(dest);
      fs.readdirSync(src).forEach(childItemName => {
        copySync(pathUtil.join(src, childItemName), pathUtil.join(dest, childItemName));
      });
    } else {
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
  }
}

function writeJsonFile(filename, data) {
  try {
    if (!filename) throw new Error('writeJsonFile: Undefined filename!');
    data = JSON.stringify(data);
    fs.writeFile(filename, data, 'utf8', err => {
      if (err) logErr(err, filename + ' writing failed!');
    });
  } catch (e) {
    logErr(e, filename + ' writing failed!');
  }
}

function getInnerFoldersSync(path) {
  let result = [];
  try {
    if (!fs.statSync(path).isDirectory()) throw { message: 'getInnerFolders for ' + path + '. Expected directory!' };

    fs.readdirSync(path).forEach(file => {
      let f = path + '/' + file;
      if (fs.statSync(f).isDirectory()) result.push(file);
    });
  } catch (e) {
    console.log('ERR: ' + e.message);
  }
  return result;
}

function readDirSync(folder, opt) {
  let result;
  try {
    if (!folder) throw { message: 'Folder not defined!' };
    if (!fs.existsSync(folder)) throw { message: 'Folder not found!' };

    result = fs.readdirSync(folder);

    if (opt) {
      // Выбрать по расширению
      if (opt.ext) result = result.filter(file => file.endsWith(opt.ext));
      // Выбрать только папки
      if (opt.dir) result = result.filter(file => fs.statSync(folder + '/' + file).isDirectory());
    }
  } catch (e) {
    console.log('ERR: readDir ' + folder + '. ' + e.message);
    result = [];
  }
  return result;
}

function writeValToJsonFileSilent(filename, prop, val) {
  if (!prop) return;

  let data = readJsonFileSync(filename, true);
  if (typeof prop == 'object') {
    Object.keys(prop).forEach(key => {
      data[key] = prop[key];
    });
  } else {
    data[prop] = val;
  }
  writeJsonFileSync(filename, data, true);
}

function deepEqual(a, b) {
  return deepEqualNode(a, b);
}

function isImgFile(filename) {
  const exts = ['.png', '.svg', '.jpg', '.jpeg'];
  for (let i = 0; i < exts.length; i++) {
    if (filename.endsWith(exts[i])) return true;
  }
}

/** Получить время модификации файла **/
function getModifyTime(file) {
  var stat;
  try {
    stat = fs.statSync(file);
    return stat.mtime;
  } catch (e) {
    console.log('Error read file ' + file + '. ' + e.message);
    return -1;
  }
}

/** Получить время модификации файла **/
function getModifyTimeMs(file) {
  var stat;
  try {
    stat = fs.statSync(file);
    return Math.round(stat.mtimeMs);
  } catch (e) {
    console.log('Error read file ' + file + '. ' + e.message);
    return -1;
  }
}

/**
 * Вычислить новый ключ для массива данных
 */
function calcNewKey(data, keyfield) {
  let keyval;
  let maxkeyval = -1;

  // Если пусто - начинаем с 1
  if (!util.isArray(data) || data.length <= 0) {
    return '1';
  }

  data.forEach(item => {
    keyval = Number(item[keyfield]);
    if (!isNaN(keyval) && keyval > maxkeyval) {
      maxkeyval = keyval;
    }
  });
  return maxkeyval >= 0 ? String(maxkeyval + 1) : notNumberedKey(data[data.length - 1][keyfield]);

  // Если не число - взять последний ключ, найти в нем число и увеличить на 1:
  function notNumberedKey(pkeyval) {
    let digstr = extractNumFromStr(pkeyval);
    let j = digstr ? pkeyval.indexOf(digstr) : -1;

    // LAMP51 => LAMP52 или добавить 1 в конец LAMP => LAMP1
    return j >= 0 ? pkeyval.substr(0, j) + String(Number(digstr) + 1) : allTrim(pkeyval + '1');
  }
}

/**
 * Вычислить новый ключ для массива данных, если дан префикс
 * Путем перебора наращивать имена и проверять
 */
function calcNewId(data, keyfield, patid, first) {
  let n = first > 0 ? first : 1;
  while (data.some(item => item[keyfield] == patid + String(n))) {
    n++;
  }
  return patid + String(n);
}

/**
 * Проверяет входящий массив и актуальный Map данных
 * Если есть расхождения - делаются изменения в data
 * -
 * @param {Array of objects} data - массив данных
 * @param {Map} curmap - Map данных с вынесенным ключевым полем
 * @param {String} keyname - имя ключевого поля, id по умолчанию
 * @param {String} proplist - опционально - список полей, по которым нужно сравнить записи
 *
 * @return {Boolean} - результат true, если были изменения
 */
function revise(data, curmap, keyname, proplist) {
  let changed = false;
  if (!util.isArray(data)) {
    console.log('revise: Expected array for first param!');
    return;
  }

  if (!data || !util.isArray(data)) {
    console.log('revise: Expected array for first param!');
    return;
  }

  keyname = keyname || 'id';
  if (proplist && typeof proplist == 'string') proplist = proplist.split(',');
  if (proplist && !util.isArray(proplist)) proplist = '';

  for (let i = data.length - 1; i >= 0; i--) {
    let keyval = data[i][keyname];

    if (!curmap.has(keyval)) {
      // удалить элемент массива, если его нет в актуальных данных
      data.splice(i, 1);
      changed = true;
    } else {
      // проверить совпадение с актуальными данными
      if (proplist) {
        changed = changed || doObjPlainPropsEqual(data[i], curmap.get(keyval), proplist);
      }
      curmap.delete(keyval);
    }
  }

  // добавить новые элементы массива
  if (curmap.size > 0) {
    curmap.forEach(val => data.push(clone(val)));
    changed = true;
  }
  return changed;
}

function doObjPlainPropsEqual(obj1, obj2, proplist) {
  let changed;
  let prop;
  for (let i = 0; i < proplist.length; i++) {
    prop = proplist[i];
    if (obj1[prop] !== obj2[prop]) {
      obj1[prop] = obj2[prop];
      changed = true;
    }
  }
  return changed;
}

/**
 *
 * @param {*} file
 * @param {*} mode
 * Возбуждает исключение при ошибке!!
 */
function checkFileAndChangeModeSync(file, mode) {
  if (!file) return;
  if (!fs.existsSync(file)) throw { message: 'File not found ' + file };
  let stat = fs.statSync(file);
  if (stat.mode != mode) {
    fs.chmodSync(file, mode);
  }
}

function getArch() {
  let result;
  switch (process.arch) {
    case 'arm':
      result = 'arm';
      break;
    case 'ia32':
      result = '386';
      break;
    case 'x64':
      result = 'amd64';
      break;
    default:
      result = process.arch;
  }
  return result;
}

function getCmdErrObj(err, stderr, cmd) {
  let cmdname = cmd ? cmd.split(' ').shift() : '';
  let msg = stderr || '';
  let errno = '';
  if (typeof err == 'object') {
    msg += err.message ? err.message : util.inspect(err);
  } else {
    errno = ' ERRNO: ' + String(err);
  }
  return { message: 'Command: ' + cmd + +errno + ' error: ' + cmdname + ': ' + msg };
}

function shortenErrResponse(e) {
  if (typeof e == 'object' && e.message) {
    e.message = getErrTail(e.message);
  }
  return e;

  function getErrTail(str) {
    let idx = str.lastIndexOf('error:');
    return idx > 0 ? str.substr(idx + 6) : str;
  }
}

function timeFormat(sec, pref) {
  // let seconds = sec % 60;
  let minutes = Math.floor(sec / 60);
  let hours = Math.floor(minutes / 60);
  if (hours > 0) minutes -= hours * 60;

  let days = Math.floor(hours / 24);
  if (days > 0) hours -= days * 24;

  // return pad(days)+' '+pad(hours)+':'+pad(minutes)+':'+pad(seconds);
  if (!pref || !util.isArray(pref) || pref.length != 3) {
    pref = [' д.', ' ч.', ' м.'];
  }
  return days + pref[0] + ' ' + hours + pref[1] + ' ' + minutes + pref[2];
}

/** Удалить папку  рекурсивно, включая поддиректории **/
function delFolderSync(folder, onlyContent) {
  let filelist;

  try {
    filelist = fs.readdirSync(folder);
    if (!util.isArray(filelist)) {
      throw { name: 'FileError', message: 'Error reading folder ' + folder };
    }

    for (var i = 0; i < filelist.length; i++) {
      let stats = fs.statSync(folder + '/' + filelist[i]);
      if (stats.isDirectory()) {
        delFolderSync(folder + '/' + filelist[i]);
      } else {
        fs.unlinkSync(folder + '/' + filelist[i]);
      }
    }

    if (!onlyContent) {
      fs.rmdirSync(folder); // удалить саму папку
    }
    return true;
  } catch (e) {
    console.log('ERR: Error delFolderSync ' + folder + ': ' + e.message);
    return false;
  }
}

function delFileSync(file) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  } catch (e) {
    console.log('ERR: Error delFileSync for  ' + file + ': ' + e.message);
  }
}

function unrequire(moduleName) {
  var fullPath = require.resolve(moduleName);
  console.log('UNREQ ' + fullPath);
  delete require.cache[fullPath];
}

function isStringMatch(str, exp) {
  if (str && typeof str == 'string') {
    if (isRegExp(exp)) return str.match(exp);
    if (typeof exp == 'string') return str == exp;
  }
}

function isRegExp(obj) {
  return obj instanceof RegExp;
}

function evaluateObj(str) {
  const fn = new Function('', 'return ' + str);
  return fn();
}

function getSecInterval(ts1, ts2) {
  return ts2 <= ts1 ? 0 : Math.round((ts2 - ts1) / 1000);
}

function getFormattedValue(val, decdig = 0) {
  return isNaN(val) ? '' : Number(val).toFixed(decdig);
}

/*
function curry(fn) {
  let arity = fn.length; //  number of arguments fn expects
  return (...args) => {
    let firstArgs = args.length;
    if (firstArgs >= arity) {
      // correct number of arguments
      return fn(...args);
    }
    return (...secondArgs) => {
      return fn(...[...args, ...secondArgs]); // (7)
    };
  };
}
*/
