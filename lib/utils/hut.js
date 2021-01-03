/**
 *  hut.js - служебные утилиты
 */
const util = require('util');
const suncalc = require('suncalc');

const deepEqual = require('./deepEqual');

/*
 * Строковые функции
 */
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
exports.getFolderNameForZip = getFolderNameForZip;
exports.getFileNameFromPathName = getFileNameFromPathName;
exports.pad = pad;
exports.isIdValid = isIdValid;
exports.getFormattedValue = getFormattedValue;
exports.isStringMatch = isStringMatch;

/**
 *  Обработка объектов
 */
exports.deepEqual = deepEqual;
// isTheSameArray - use deepEqual
exports.isObjIdle = isObjIdle;
exports.isRegExp = isRegExp;
exports.addSuffToPropNames = addSuffToPropNames;
exports.deletePropsWithSuff = deletePropsWithSuff;
exports.isInFilter = isInFilter;
exports.isValSatisfyToFilter = isValSatisfyToFilter;
exports.clone = clone;
exports.extend = extend;
exports.removeProps = removeProps;
exports.mapProps = mapProps;
exports.mapPropsStrict = mapPropsStrict;
exports.formOneObj = formOneObj;
exports.formArrayReplay = formArrayReplay;
exports.locateFirstRecord = locateFirstRecord;
exports.objMustHaveProps = objMustHaveProps;

exports.getFieldProjection = getFieldProjection;
exports.getStrictMappedObj = getStrictMappedObj;
exports.getPropNamesArrayFromSetObj = getPropNamesArrayFromSetObj;
exports.getAttrsObjFromSetObj = getAttrsObjFromSetObj;

/**
 * Array
 */
exports.arrayToObject = arrayToObject;
exports.arrayToDict = arrayToDict;
exports.objectToArray = objectToArray;
exports.arrayToGroupObjectWithElementArray = arrayToGroupObjectWithElementArray;

exports.arrayDiff = arrayDiff;
exports.arraySymmetricDiff = arraySymmetricDiff;
exports.arrayIntersection = arrayIntersection;
exports.createIdsInFilter = createIdsInFilter;

/**
 *  Дата и время
 */
exports.getDateTimeFor = getDateTimeFor;
exports.timeFormat = timeFormat;
exports.isTheSameDate = isTheSameDate;
exports.isNextDateLater = isNextDateLater;
exports.getSecInterval = getSecInterval;
exports.getTs = getTs;
exports.getSunTime = getSunTime;
exports.dateToISOString = dateToISOString;

/**
 *  Misc
 */
exports.isImgFile = isImgFile;
exports.unrequire = unrequire;
exports.evaluateObj = evaluateObj;
exports.getCmdErrorMsg = getCmdErrorMsg;
exports.getCmdErrObj = getCmdErrObj;
exports.shortenErrResponse = shortenErrResponse;
exports.getShortErrStr = getShortErrStr;
exports.calcNewKey = calcNewKey;
exports.calcNewId = calcNewId;
exports.byorder = byorder;
exports.revise = revise;
exports.getRandomInt = getRandomInt;
exports.getNumberOrNull = getNumberOrNull;
exports.prefAt = prefAt;
exports.getFunctionArguments = getFunctionArguments;
exports.getFunctionOptionArgument = getFunctionOptionArgument;

/**
 *  Удаление space-символов (пробел, табуляция, новая строка) в начале и конце строки.
 *  [\s] -  то же что и [\n\t\r\f]
 *  @param  {String} str
 *  @return {String}
 */
function allTrim(str) {
  return str && typeof str === 'string' ? str.replace(/^\s+/, '').replace(/\s+$/, '') : '';
}

/**
 * Перевод первого символа строки в верхний регистр
 *  @param  {String} str
 *  @return {String}
 */
function firstToUpper(str) {
  return str && typeof str === 'string' ? str.substr(0, 1).toUpperCase() + str.substr(1) : '';
}

/**
 * Удаление символов двойных кавычек, окружающих строку.
 *    - Пробельные символы до и после кавычек также удаляются
 *    - Если начальной кавычки нет - удаляются только пробелы
 *  @param  {String} str
 *  @return {String}
 */
function removeBorderQuotes(str) {
  let result = allTrim(str);
  return result && result.substr(0, 1) === '"' ? result.substr(1, result.length - 2) : result;
}

/**
 * Возвращает первые  qwords слов в строке как строку
 * Несколько пробельных символов заменяется одним пробелом. Начальные пробельные символы очищаются
 *
 *  @param  {String} astr
 *  @param  {Number} qwords - число слов
 *  @return {String}
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
 *  @param  {String} astr
 *  @return {String}
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

/** Возвращает true, если входная строка - это символ операции: =, >, <
 *  @param  {String} astr
 *  @return {Bool}
 *  **/
function isOper(astr) {
  let str = allTrim(astr);
  return str.length === 1 && /[<>=]/.test(str.charAt(0));
}

/** Пересечение двух csv-строк (Comma-Separated Values)
 *    (списки имен, идентификаторов через запятую)
 *
 *   @param  {String} list1 - csv-строка
 *   @param  {String} list2 - csv-строка
 *   @return {String} - Возвращает csv -строку пересечения
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
 *   Пример: H_102_1 =>102
 *   @param  {String} str
 *   @return {String} - Возвращает строку, содержащую только числовые символы
 **/
function extractNumFromStr(str) {
  let rar = str && typeof str == 'string' ? /\d+/.exec(str) : '';
  return rar && rar.length > 0 ? rar[0] : '';
}

/** Удаляет из строки последние числовые символы идущие подряд.
 *   Если в конце нет чисел - возвращает входную строку
 *   Пример: LAMP_102 => LAMP_
 *   Пример: LAMP_102_2 => LAMP_102_
 *
 *   @param  {String} str
 *   @return {String}
 **/
function removeLastNumFromStr(str) {
  if (typeof str != 'string') return str;

  let res = str.match(/\d+$/);
  return res && res.index && res.index > 0 ? str.substr(0, res.index) : str;
}

/** Возвращает расширение файла
 *
 *   @param  {String} str
 *   @return {String} - расширение файла без точки
 **/
function getFileExt(filename) {
  let parts = filename.split('.');
  return parts.length > 1 ? parts.pop() : '';
}

/** Возвращает имя файла с расширениеь
 *
 *   @param  {String} str
 *   @return {String} - имя файла
 **/
function getFileNameFromPathName(fullname) {
  return fullname
    .split('\\')
    .pop()
    .split('/')
    .pop();
}

/** Возвращает имя файла без расширения
 *
 *   @param  {String} str
 *   @return {String} - имя файла
 **/
function getFileNameExtLess(fullname) {
  let filename = getFileNameFromPathName(fullname);
  return filename.split('.').shift();
}

/** Возвращает папки по имени файла (для zip архива)
 *
 *   @param  {String} filename - имя файла
 *   @return {String} - имя папки
 **/
function getFolderNameForZip(filename) {
  return allTrim(
    getFileNameExtLess(filename)
      .toLowerCase()
      .replace(/[()[\]]/g, '')
  );
}

/** Возвращает строку заданной длины, содержащую число с ведущими нулями
 *   (55,4) => '0055'
 *   @param  {Number | String} val
 *   @param  {Number} width
 *   @return {String}
 */
function pad(val, width = 2) {
  return String(val).padStart(width, '0');
}

/** Проверка строки в качестве идентификатора
 * Идентификатор может содержать только лат буквы, цифры и подчеркивание
 * Первый символ д.б. не цифра
 *    @param  {String} str
 *    @return {Bool}
 */
function isIdValid(str) {
  return /^[a-zA-Z_]/.test(str) && !/[^a-zA-Z0-9_]/.test(str);
}

/** Возвращает отформатированное число в виде строки
 *
 *   @param  {Number | String} val
 *   @param  {Number} decdig - число знаков после запятой
 *   @return {String}
 *   Если входящее значение не число - возвращает пустую строку
 */
function getFormattedValue(val, decdig = 0) {
  return isNaN(val) ? '' : Number(val).toFixed(decdig);
}

/** Проверка, что строка совпадает с образцом
 *  @param  {String} str - проверяемая строка
 *  @param  {String | RegExp} exp - образец
 *  @return true - если совпадает
 */
function isStringMatch(str, exp) {
  if (!str || typeof str != 'string') return false;
  if (isRegExp(exp)) return str.match(exp);
  if (typeof exp == 'string') return str == exp;
}

/** *********** Обработка объектов  ***************** **/

/** Проверка, что объект нерабочий
 *  @param  {Object} obj - проверяемый объект
 *  @return true - если НЕ объект или объект пуст
 */
function isObjIdle(obj) {
  return typeof obj !== 'object' || Object.keys(obj).length <= 0;
}

/** Проверка, что объект RegExp
 *  @param  {Object} obj - проверяемый объект
 *  @return true - если RegExp
 */
function isRegExp(obj) {
  return obj instanceof RegExp;
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
 * @param {Object} indata - проверяемый объект
 * @param {Object} filter - фильтр
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

  // return !Object.keys(filter).some(fi => indata[fi] === undefined || !isValSatisfyToFilter(indata[fi], filter[fi]));
  return !Object.keys(filter).some(fi =>
    typeof filter[fi] == 'string' && filter[fi].startsWith('!def')
      ? indata[fi]
      : indata[fi] === undefined || !isValSatisfyToFilter(indata[fi], filter[fi])
  );
}

/** isValSatisfyToFilter - проверка, что значение val удовлетворяет фильтру
 *  @param val       {Number||String}  - проверяемое значение
 *  @param filterVal {Number||String||Array} - фильтр.
 *                  Может быть список в виде массива или строка через запятую.
 *                  Тогда требуется совпадение с одним из элементов строки (массива)
 *
 *  @return true, если условия фильтра удовлетворяются
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

function arrayDiff(arr1, arr2) {
  return arr1.filter(x => !arr2.includes(x));
}

function arraySymmetricDiff(arr1, arr2) {
  return arr1.filter(x => !arr2.includes(x)).concat(arr2.filter(x => !arr1.includes(x)));
}

function arrayIntersection(arr1, arr2) {
  return arr1.filter(x => arr2.includes(x));
}

function createIdsInFilter(arr) {
  const filter = {};
  if (arr.length == 1) {
    filter._id = arr[0];
  } else {
    filter._id = { $in: arr };
  }
  return filter;
}

/**
 *  Полное (а не поверхностное) копирование объекта
 *   @param  {*}  parent  - исходный объект или массив (может быть scalar - тогда он и возвращается)
 *   @param  {Object | undefined} child - результирующий - может быть undefined - тогда создается заново
 *   @param  {Bool} mixin  true:добавляются только отстутствующие свойства
 *                         false: все совпадающие свойства будут перезаписаны
 *   @return {*}
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

/**
 *  Полное (а не поверхностное) расширение объекта
 *   @param  {Object} main  - объект для расширения
 *   @param  {Object} toadd - объект из которого добавляются новые свойства для расширения
 *           Добавляются только отстутствующие свойства!
 *
 *   @return {Object}
 */
function extend(main, toadd) {
  return typeof toadd == 'object' ? clone(toadd, main, true) : main;
}

/**
 *  Удаление свойств из объекта
 *   @param  {Object} main  - объект
 *   @param  {Object} toremove - объект содержит свойства для удаления
 *   @return {Object} - объект main (после удаления свойств или как был)
 */
function removeProps(main, toremove) {
  if (main && typeof main == 'object' && toremove && typeof toremove == 'object') {
    Object.keys(toremove).forEach(prop => {
      delete main[prop];
    });
  }
  return main;
}

/**
 *
 * @param {Array} data - source array to map
 * @param {Object} propmap - map rules
 * @param {Object} propext - object to add
 * @return {Array} - transformed data array
 */
function mapProps(data, propmap, propext = {}) {
  return data.map(item => Object.assign({}, getMappedObj(item, propmap), propext));
}

function getMappedObj(obj, propmap) {
  const resobj = {};

  Object.keys(obj).forEach(prop => {
    if (propmap[prop] != undefined) {
      resobj[propmap[prop]] = obj[prop];
    } else resobj[prop] = obj[prop];
  });
  return resobj;
}

function mapPropsStrict(data, propmap, propext = {}) {
  return data.map(item => Object.assign({}, getStrictMappedObj(item, propmap), propext));
}

function getStrictMappedObj(obj, propmap) {
  const resobj = {};

  Object.keys(obj).forEach(prop => {
    if (propmap[prop] != undefined) {
      resobj[propmap[prop]] = obj[prop];
    }
  });
  return resobj;
}
/**
 * Формирование одного объекта по списку полей
 *    @param  {Object} dataItem - строка таблицы
 *    @param  {String | Array} fieldlist - Список запрашиваемых полей
 *    @param  {Bool} all
 *               Если all и список полей определен, то включить все поля в запись,
 *               даже если их нет в dataItem (в виде пустой строки)
 *    @return {Object} - результат
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
 * 
 * @param {Object} setObj 
 * {
      'props.value.dbmet': 1,
      'props.value.dbcalc_type': 'minmax',
      'props.state.dbmet': 2,
      'props.setpoint.dbtm': '30'
    }
 *  @return {Array of String}  ['value','state','setpoint']
 */
function getPropNamesArrayFromSetObj(setObj) {
  const propset = new Set();
  if (setObj) {
    Object.keys(setObj).forEach(field => {
      if (field.startsWith('props.')) {
        propset.add(field.substr(6).split('.')[0]);
      }
    });
  }
  return [...propset];
}

function getAttrsObjFromSetObj(setObj, prop) {
  const attrObj = {};
  if (setObj) {
    Object.keys(setObj).forEach(field => {
      if (field.startsWith('props.')) {
        const arr = field.substr(6).split('.');
        if (arr.length == 2 && arr[0] == prop) {
          attrObj[arr[1]] = setObj[field];
        }
      }
    });
  }
  return attrObj;
}

/**
 *  Формирование массива из  массива данных
 *  формируем элемент массива по списку полей или возвращаем все поля
 *    @param   {Array} indata - входящий
 *    @param   {Object} filter - фильтр
 *    @param   {String | Array} fieldlist  - Список полей
 *    @return  {Array} - результат
 */
function formArrayReplay(indata = [], filter, fieldlist) {
  return !filter && !fieldlist
    ? clone(indata)
    : indata.filter(item => isInFilter(item, filter)).map(item => formOneObj(item, fieldlist));
}

/**
 *  Поиск первой записи в массиве данных по фильтру, вернуть объект
 *  формируем элемент массива по списку полей или возвращаем все поля
 *    @param   {Array} indata - входящий
 *    @param   {Object} filter - фильтр
 *    @param   {String | Array} fieldlist  - Список полей
 *    @return  {Object} - результат
 */
function locateFirstRecord(indata, filter, fieldlist) {
  if (!indata || !util.isArray(indata)) return;
  for (let i = 0; i < indata.length; i++) {
    // Возвращаем первую запись
    if (isInFilter(indata[i], filter)) return formOneObj(indata[i], fieldlist);
  }
}

/**
 * Функция проверяет, что объект имеет заданные свойства.
 * Если нет - возбуждает исключение
 * Если входной параметр не объект, или строка не задана - ничего не делает
 *
 *    @param {*} obj
 *    @param {*} proplist
 *    @throw
 */
function objMustHaveProps(obj, proplist) {
  if (typeof obj !== 'object' || typeof proplist !== 'string') return;

  proplist.split(',').forEach(prop => {
    if (obj[prop] == undefined) throw new Error(`Missing ${prop}`);
  });
}

/**
 * Преобразует массив в объект.
 * В качестве ключа выносится свойство pop, преобразованное в строку
 * Если prop undefined - подобъект не включается
 *
 *   [{id:xx, name:'XX'}, {id:yy, name:'YY'},{name:'ZZ'}]
 *   => {xx:{id:xx,name:'XX'}, yy:{id:yy,name:'YY'}}
 *
 *   Вложенные объекты клонируются, а не копируются по ссылке!!
 *   Поэтому деструктуризация не исп-ся
 *
 *    @param {Array} data - входной массив
 *    @param {String} prop - имя свойства-ключа
 *    @return  {Object} - результат
 */
function arrayToObject(data, prop = 'id') {
  let result = data;

  if (util.isArray(data)) {
    let id;
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
 *
 * [{id:xx, name:'XX'}, {id:yy, name:'YY'},{name:'ZZ'}]
 *   keyprop='id', valprop='name'
 *   => {xx:'XX', yy:'YY'}
 *
 *    @param  {Array} data - входной массив
 *    @param  {String} keyprop - имя свойства-ключа
 *    @param  {String} valprop - имя свойства-значения
 *    @return {Object} - результат
 */
function arrayToDict(data, keyprop, valprop) {
  const result = {};
  if (data && util.isArray(data)) {
    data.forEach(item => {
      if (item[keyprop] != undefined) {
        result[String(item[keyprop])] = item[valprop] || '';
      }
    });
  }
  return result;
}

/**
 * Формирует из массива объект с группировкой по полю  keyprop
 * В группе формируется массив из значений поля valprop
 *
 *  keyprop='key', valprop='name'
 * [{key:xx, name:'XX'}, {key:yy, name:'YY'},{key:yy, name:'ZZ'}]
 *   => {xx:['XX'], yy:['YY', 'ZZ']}
 *
 *    @param  {Array} arr - входной массив
 *    @param  {String} keyprop - имя свойства-ключа
 *    @param  {String} valprop - имя свойства-значения
 *    @return {Object} - результат
 *
 *    Если на входе не массив или элементы не объекты, то возвращается пустой объект
 */
function arrayToGroupObjectWithElementArray(arr, keyprop, valprop) {
  if (!arr || !Array.isArray(arr) || !keyprop || !valprop) return {};

  const res = {};
  arr.forEach(item => {
    if (item[keyprop] != undefined && item[valprop] != undefined) {
      const key = item[keyprop];
      if (!res[key]) res[key] = [];
      res[key].push(item[valprop]);
    }
  });
  return res;
}

/** item =>
 * Преобразует объект в массив
 * Ключ включается в элемент массива с именем свойства keyprop
 *
 * {xx:{name:'XX', txt1:'tt'}, yy:{id:yy,name:'YY', txt2:'tt'}}
 *     => keyprop = 'myp'
 * [{myp:xx, name:'XX', txt1:'tt'}, {myp:yy, name:'YY', txt2:'tt'}]
 *
 *    @param  {Object} data - входной объект
 *    @param  {String} keyprop - имя свойства-ключа
 *    @return {Array} - результат
 *
 *    Если на входе не объект, то возвращается пустой массив
 */
function objectToArray(data, keyprop = 'id') {
  return data && typeof data === 'object'
    ? Object.keys(data).map(prop => Object.assign({ [keyprop]: prop }, data[prop]))
    : [];
}

/**
 *
 * @param {Object} propmap
 */
function getFieldProjection(propmap) {
  const res = {};
  Object.keys(propmap).forEach(prop => {
    res[prop] = 1;
  });
  return res;
}

/**  Дата и время */

/**  Дата [время] в виде строки  заданного формата
 *    @param  {Date} dt - дата
 *    @param  {String} format
 *    @return {String}
 */
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

    case 'dtms': // DD.MM.YY HH:MM:SS.mmm
      return (
        pad(dt.getDate()) +
        '.' +
        pad(dt.getMonth() + 1) +
        '.' +
        String(dt.getFullYear() - 2000) +
        ' ' +
        pad(dt.getHours()) +
        ':' +
        pad(dt.getMinutes()) +
        ':' +
        pad(dt.getSeconds()) +
        '.' +
        pad(dt.getMilliseconds(), 3)
      );

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

function dateToISOString(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

/**  Сравнивает две даты на равенство (день, месяц, год)
 *   Можно передать Date или timestamp
 *    @param  {Date|timestamp} adt1 - дата
 *    @param  {Date|timestamp} adt2 - дата
 *    @return {Bool} true, если дата совпадает
 */
function isTheSameDate(adt1, adt2) {
  const dt1 = getDateObj(adt1);
  const dt2 = getDateObj(adt2);

  return dt1 && dt2
    ? dt1.getFullYear() == dt2.getFullYear() && dt1.getMonth() == dt2.getMonth() && dt1.getDate() == dt2.getDate()
    : false;
}

/**  Сравнивает, является ли день второй даты более поздним
 *   Можно передать Date или timestamp
 *    @param  {Date|timestamp} adt1 - дата
 *    @param  {Date|timestamp} adt2 - дата
 *    @return {Bool} true, день второй даты позже первой (не в один день!)
 */
function isNextDateLater(adt1, adt2) {
  const dt1 = getDateObj(adt1);
  const dt2 = getDateObj(adt2);

  return dt1 && dt2 ? !isTheSameDate(dt1, dt2) && dt1.getTime() < dt2.getTime() : false;
}

function getDateObj(dt) {
  if (dt instanceof Date) return dt;
  if (typeof dt == 'number') return new Date(dt);
}

function getDateTimestamp(dt) {
  if (typeof dt == 'number') return dt;
  if (dt instanceof Date) return dt.getTime();
}

/**  Возвращает интервал в секундах между двумя датами
 *
 *    @param  {Date|timestamp} adt1 - дата
 *    @param  {Date|timestamp} adt2 - дата
 *    @return {Number} интервал в секундах
 *  Если вторая дата раньше первой либо одна из дат не является датой, то возвр 0
 */
function getSecInterval(adt1, adt2) {
  const ts1 = getDateTimestamp(adt1);
  const ts2 = getDateTimestamp(adt2);
  return ts1 && ts2 && ts2 > ts1 ? Math.round((ts2 - ts1) / 1000) : 0;
}

/**  Возвращает интервал в секундах как строку дней, часов, минут
 *
 *    @param  {Number} sec - интервал в секундах
 *    @param  {Array of String} pref - единицы измерения - дн час мин
 *    @return {String}
 */
function timeFormat(sec, pref) {
  let minutes = Math.floor(sec / 60);
  let hours = Math.floor(minutes / 60);
  if (hours > 0) minutes -= hours * 60;

  let days = Math.floor(hours / 24);
  if (days > 0) hours -= days * 24;

  if (!pref || !util.isArray(pref) || pref.length != 3) {
    pref = ['d', 'h', 'm'];
  }
  return days + pref[0] + ' ' + hours + pref[1] + ' ' + minutes + pref[2];
}

function getTs(timePoint) {
  if (typeof timePoint == 'number' && timePoint > 0) return timePoint;
  if (typeof timePoint == 'string') return Date.parse(timePoint);
}

/**
 * Возвращает время восхода/заката для заданной локации
 * @param {String} name  'sunrise'| 'sunset' - если не задано - вернет 0
 *
 * @param {Date | String | Number | undefined} date - на дату
 *      Варианты: 'today', 'tomorrow'
 *                 объект типа Date
 *                 timestamp
 *
 * @param {*} location {lat, lng} - если не задано - вернет 0
 *
 * @return {number} timestamp || 0
 */
function getSunTime(name, date, location) {
  if (!location || !location.lat || !location.lng) return 0;

  let getDate = getThisDate(date);
  let suntimes = suncalc.getTimes(getDate, location.lat, location.lng);
  return suntimes[name] ? suntimes[name].getTime() : 0;
}

/**
 * Возвращает объект Date для различных входных значений
 * @param {Date | String | Number | undefined} date
 */
function getThisDate(date) {
  const today = new Date();
  if (!date) date = today; // undefined - вернет текущую дату

  if (date instanceof Date) {
    // передали дату - вернет ее
    return date;
  }

  if (typeof date == 'string') {
    switch (date) {
      case 'tomorrow':
        return new Date().setDate(today.getDate() + 1);

      case 'today':
      default:
        return today;
    }
  }

  if (typeof date == 'number') {
    return new Date(date); // Вернуть дату на базе timestamp
  }
}

/**
 *  Misc
 */

/**  На основании расширения определяет, является ли файл файлом изображением
 *
 *    @param  {String} filename
 *    @return {Bool} true - да
 */
function isImgFile(filename) {
  return filename ? ['.png', '.svg', '.jpg', '.jpeg'].some(item => filename.endsWith(item)) : false;
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

function getCmdErrorMsg(err, stderr, cmd) {
  let cmdname = cmd ? cmd.split(' ').shift() : '';
  let msg = stderr || ' ';
  let errno = '';
  if (typeof err == 'object') {
    msg += err.message ? err.message : util.inspect(err);
  } else {
    errno = ' ERRNO: ' + String(err);
  }
  return `Command ${cmd} ${errno}  error:  ${cmdname}: ${msg}`;
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

function getShortErrStr(e) {
  if (typeof e == 'object') return e.message ? getErrTail(e.message) : JSON.stringify(e);
  if (typeof e == 'string') return e.indexOf('\n') ? e.split('\n').shift() : e;
  return String(e);

  function getErrTail(str) {
    let idx = str.lastIndexOf('error:');
    return idx > 0 ? str.substr(idx + 6) : str;
  }
}

function unrequire(moduleName) {
  try {
    const fullPath = require.resolve(moduleName);
    delete require.cache[fullPath];
  } catch (e) {
    // Может и не быть
  }
}

function evaluateObj(str) {
  const fn = new Function('', 'return ' + str);
  return fn();
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

/** Функция сортировки используется в качестве вызываемой функции для сортировки массива ОБЪЕКТОВ
 *   arr.sort(hut.byorder('place,room','D')
 *   Возвращает функцию сравнения
 *
 *    @param {String}  ordernames - имена полей для сортировки через запятую
 *    @param {String}   direction: D-descending else ascending
 *    @return {function}
 *
 **/
function byorder(ordernames, direction, parsingInt) {
  let arrForSort = [];
  const dirflag = direction == 'D' ? -1 : 1; // ascending = 1, descending = -1;

  if (ordernames && typeof ordernames == 'string') arrForSort = ordernames.split(',');

  return function(o, p) {
    if (typeof o != 'object' || typeof p != 'object') return 0;
    if (arrForSort.length == 0) return 0;

    for (let i = 0; i < arrForSort.length; i++) {
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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min; // Максимум не включается, минимум включается
}

function getNumberOrNull(val) {
  if (val == undefined || val == '') return null;
  return isNaN(val) ? null : Number(val);
}

function prefAt(id) {
  return id && id.indexOf('@') > 0 ? id.split('@')[0] : '';
}

/**
 * Выделяет аргументы функции, возвращает массив аргументов
 *
 * @param {Function} x
 * @return {Array of Strings} ['device','prop','val']
 */
function getFunctionArguments(x) {
  const res = x.toString().match(/\([^)]+\)/);
  if (!res) return;

  // (device, prop, val, {timeout=5, xx=4}) => ['device', 'prop', 'val', '{timeout=5', 'xx=4}'] - опции разбиты
  return res[0]
    .substr(1, res[0].length - 2)
    .split(',')
    .map(el => allTrim(el));
}


/**
 * Выделяет последний аргумент функции, если это объект 
 *   Цель - параметризация обработчиков:
 *   function(device, prop, val, {timeout=5, any=42})
 *
 * @param {Function} x
 * @return {String} {"timeout":5,"any":42} - возвращается строка объекта
 */
function getFunctionOptionArgument(x) {
  const args = getFunctionArguments(x);
  if (!args || !args.length) return;

  // Опции уже разбиты
  const optIdx = args.findIndex(el => el.substr(0, 1) == '{');
  if (optIdx < 0) return;

  const opt = {};
  args[optIdx] = args[optIdx].substr(1);
  for (let i = optIdx; i < args.length; i++) {
    let el = args[i];
    if (el) {
      if (el.substr(-1) == '}') el = el.substr(0, el.length - 1);

      if (el.indexOf('=') > 0) {
        const elarr = el.split(/\s*=\s*/);
        opt[elarr[0]] = isNaN(elarr[1]) ? elarr[1] : Number(elarr[1]);
      } else opt[el] = '';
    }
  }
  return JSON.stringify(opt);
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
