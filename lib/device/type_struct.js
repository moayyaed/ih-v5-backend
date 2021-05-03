/**
 * type_struct.js
 *
 * Структура элемента typeMap - создается из документа таблицы types
 *
 *  item - содержит описательную часть {_id, name, tags,...}
 *
 *  props - объект всех свойств прямо из таблицы,
 *           из него будут браться плоские атрибуты св-ва (vtype, op,..., fuse, format,..)
 *           Для функций-обработчиков добавляются объекты:
 *            handler:{name, filename, fn},
 *            formathandler:{name, filename, fn}
 *               .name - имя встроенной функции
 *               .filename - полное имя файла (скрипта)
 *               .fn - функция (тело функции, загружается при первом запросе выполнения)
 *
 *  proparr - массив свойств-значений устройства, содержит значения по умолчанию: min,max,def,dig
 *          Нужно перестраивать при изменении таблицы types
 *  commands - массив свойств-команд устройства, просто массив строк
 *           Нужно перестраивать при изменении таблицы types
 *  calc - список свойств типа calc - [{prop:'state', when:'1', trigger:'value'}] (when,trigger НЕ ИСП!!)
 *
 * onHandlers: - объект c обработчиками верхнего уровня (не свойства) для каждого event:
 *      [_onChange | _onSchedule | _onInterval] = {filename, fn}
 *          .filename - полное имя файла
 *          .fn - функция - только при запуске
 *           name здесь нет, так как нет встроенных обработчиков
 * 
 * alerts: правила формирования тревоги для каждого свойства отдельно - если есть флан ale в props[prop]
 *  - Здесь храним как есть в документе или формируем дефолтный вариант?, если флаг установлен, а в таблице нет
 */

const util = require('util');

const hut = require('../utils/hut');
// const deviceutil = require('./deviceutil');
const handlerutil = require('./handlerutil');
const defaulthandlers = require('./defaulthandlers');
const defaultalerts = require('./defaultalerts');

/**  create
 * Создать анемичный объект (структуру) типа
 *
 * @param {Object} typeDoc - документ из types
 *
 * @return {Object} - объект типа
 */
function create(typeDoc) {
  const typeObj = { _id: typeDoc._id, item: {}, props: {}, proparr: [], calc: [], onHandlers: {}, alerts: {} };

  Object.keys(typeDoc).forEach(docProp => {
    if (docProp == 'props') {
      updateProps(typeObj, typeDoc.props);
    } else if (docProp != 'alerts') {
      // Плоские свойства - в item
      typeObj.item[docProp] = typeDoc[docProp];

      if (docProp.startsWith('scriptOn') && typeDoc[docProp]) {
        // scriptOnChange: 1
        const event = '_' + docProp.substr(6);
        typeObj.onHandlers[event] = fillHandlerObj(typeObj, event);
      }
    }
  });

  updateAlerts(typeObj, typeDoc.alerts);
  return typeObj;
}

function updateProps(typeObj, newprops) {
  if (!typeObj || !newprops) return;

  // Объект props содержит описание свойств - его полностью берем
  typeObj.props = hut.clone(newprops);
  typeObj.proparr = []; // cвойства-значения
  typeObj.commands = []; // cвойства-команды
  typeObj.calc = [];

  Object.keys(typeObj.props).forEach(prop => {
    typeObj.props[prop].handler = fillPropHandlerObj(typeObj, prop);
    typeObj.props[prop].formathandler = fillPropFormatHandlerObj(typeObj, prop);

    const p = typeObj.props[prop];
    if (p.op == 'cmd') {
      typeObj.commands.push(prop);
    } else {
      typeObj.proparr.push({ prop, ...getProparrAux(prop, p) });
    }

    // Сохранить имя свойства для полей calculate  (when, trigger НЕ ИСПОЛЬЗУЕТСЯ?)
    if (p.op == 'calc') typeObj.calc.push({ prop, when: p.when || '0' });
    // if (p.op == 'calc') typeObj.calc.push({ prop, when: p.when || '0', trigger: getTriggerObj(p.trigger) });
  });
}

function updateAlerts(typeObj, alertsObj = {}) {

  // Заново обновляется всегда?
  Object.keys(typeObj.props).forEach(prop => {
    if (typeObj.props[prop].ale) {
      if (alertsObj[prop]) {
        typeObj.alerts = alertsObj[prop];
      } else {
        typeObj.alerts = defaultalerts(typeObj.props[prop].vtype);
      }
    } 
  });
}

// Обработчики верхнего уровня
function fillHandlerObj(typeObj, event) {
  const typeId = typeObj._id;
  const filename = handlerutil.getHandlerFilename(typeId, event);
  return { filename, fn: '', blk: typeObj['err' + event] ? 1 : 0 };
}

function fillPropHandlerObj(typeObj, prop) {
  // propItem.fuse: 0-обработчик не используется, 1-default, 2-внешний (из файла)
  const typeId = typeObj._id;
  const propItem = typeObj.props[prop];
  if (!propItem) {
    console.log('ERROR: fillPropHandlerObj not found '+prop+' in typeObj='+util.inspect(typeObj))
    return '';
  }
  if (!propItem.fuse) return '';

  let name = '';
  let filename = '';
  let sys = 1;
  if (propItem.fuse == 1) {
    name = handlerutil.getDefaultHandlerName(typeId, prop, typeObj);
  } else if (propItem.fuse == 2) { 
    filename = handlerutil.getHandlerFilename(typeId, prop);
    if (filename) sys=0;
  }
  return { name, filename, fn: '', blk: propItem.errstr ? 1:  0, sys};
}

function fillPropFormatHandlerObj(typeObj, prop) {
  // propItem.format: 0-обработчик не используется, 1-default, 2-внешний (из файла)
  // Также м б имена встроенных функций - тогда propItem.format = 'format_....'

  const typeId = typeObj._id;
  const propItem = typeObj.props[prop];
  if (!propItem || propItem.op == 'cmd' || !propItem.format) return '';

  let name = '';
  let filename = '';
  let sys = 1;
  if (typeof propItem.format == 'string') {
    // Имя функции выбрано
    name = 'format_' + propItem.format;
    if (!defaulthandlers[name]) name = '';
  }

  if (propItem.format == 1) {
    // Встроенная - нужно подобрать по типу
    name = 'format_def_' + propItem.vtype;
    if (!defaulthandlers[name]) name = '';
  } else if (propItem.format == 2) {
    filename = handlerutil.getHandlerFilename(typeId, '_format_' + prop);
    if (filename) sys=0;
  }
  return { name, filename, fn: '', blk: propItem.errstr_format ? 1:  0, sys};
  // errstr_format
}

/**
 *
 * @param {*} prop
 * @param {*} propItem
 */
function getProparrAux(prop, propItem) {
  // const res = { prop };
  if (!propItem || propItem.command) return;

  const res = {};
  res.mu = propItem.mu || '';
  switch (propItem.vtype) {
    case 'N':
      res.min = propItem.min || null;
      res.max = propItem.max || null;
      res.dig = propItem.dig || 0;
      res.def = propItem.def || 0;
      break;
    case 'S':
      res.def = propItem.def || '';
      break;
    case 'B':
      res.def = propItem.def || 0;
      break;
    default:
  }
  // if (propItem.fn_opt_str) res.fn_opt = propItem.fn_opt_str;

  return res;
}

/**
 * Извлечь структуру из объекта -  функции не переносятся (hut.clone их не копирует)
 * @param {Object} typeObj { _id: typeDoc._id, item: {}, props: {}, proparr: [], calc: [], onHandlers: {} };
 */
function extract(typeObj) {
  const res =  { _id: typeObj._id};

  res.item = hut.clone(typeObj.item);
  res.props = hut.clone(typeObj.props);
  res.proparr = hut.clone(typeObj.proparr);
  res.commands = hut.clone(typeObj.commands);
  res.calc = hut.clone(typeObj.calc);
  res.onHandlers = hut.clone(typeObj.onHandlers);
  return res;
}

module.exports = {
  create,
  updateProps,
  getProparrAux,

  extract
};
