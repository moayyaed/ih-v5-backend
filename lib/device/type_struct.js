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
 * alerts: правила формирования тревоги для каждого свойства отдельно
 *  - Здесь храним как в документе  alerts:{state:{Norm:{level,...}, }}
 */

const util = require('util');

const hut = require('../utils/hut');
// const deviceutil = require('./deviceutil');
const handlerutil = require('./handlerutil');
const defaulthandlers = require('./defaulthandlers');

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
    } else if (docProp == 'alerts') {
      updateAlerts(typeObj, typeDoc.alerts);
    } else {
      // Плоские свойства - в item
      typeObj.item[docProp] = typeDoc[docProp];
      processScriptOnFields(typeObj, docProp, typeDoc[docProp]);
      /*
      if (docProp.startsWith('scriptOn') && typeDoc[docProp]) {
        // scriptOnChange: 1
        const event = '_' + docProp.substr(6);
        typeObj.onHandlers[event] = fillHandlerObj(typeObj, event);
      }
      */
    }
  });

  return typeObj;
}

function processScriptOnFields(typeObj, prop, usage) {
  if (prop.startsWith('scriptOn')) {
    // scriptOnChange
    const event = '_' + prop.substr(6);
    typeObj.onHandlers[event] = fillHandlerObj(typeObj, event, usage);
  }
}

// Изменение плоских полей
function changeFlatFields(typeObj, newitem) {
  // {item: {_id, name, ruledn_pref}, proparr:[{ prop: 'value', name: 'Значение', vtype: 'B', op: 'r' },]
  Object.assign(typeObj.item, newitem);
  Object.keys(newitem).forEach(prop => {
    processScriptOnFields(typeObj, prop, newitem[prop])
  })
}

/*
function updateAlerts(typeObj, newalerts) {
  if (!typeObj || !newalerts) return;
  // TODO - значение theval должно быть нужного типа - N,B,S
  typeObj.alerts = hut.clone(newalerts);
  Object.keys(typeObj.alerts).forEach(prop => {
    const vtype = typeObj.props[prop].vtype;
    Object.keys(typeObj.alerts[prop]).forEach(ruleId => {
      let theval = typeObj.alerts[prop][ruleId].theval;
      try {
        typeObj.alerts[prop][ruleId].theval = vtype == 'S' ? String(theval) : Number(theval);
      } catch (e) {
        typeObj.alerts[prop][ruleId].theval = 0;
        console.log('ERROR: For '+prop+' with vtype="'+vtype+'" Invalid theval: '+util.inspect(typeObj.alerts[prop][ruleId]))
      }
    });
  });
}
*/

function updateAlerts(typeObj, newalerts) {
  if (!typeObj || !newalerts) return;

  // TODO - значение theval должно быть нужного типа - N,B,S
  if (!typeObj.alerts) typeObj.alerts = {};
  // = hut.clone(newalerts);
  Object.keys(newalerts).forEach(prop => {
    updateOneAlert(typeObj, prop, newalerts[prop]);
  });
}

function updateOneAlert(typeObj, prop, newalert) {
  if (!typeObj.props[prop]) return; //  нет такого свойства
  typeObj.alerts[prop] = hut.clone(newalert);

  const vtype = typeObj.props[prop].vtype;
  Object.keys(typeObj.alerts[prop]).forEach(ruleId => {
    let theval = typeObj.alerts[prop][ruleId].theval;
    try {
      typeObj.alerts[prop][ruleId].theval = vtype == 'S' ? String(theval) : Number(theval);
    } catch (e) {
      typeObj.alerts[prop][ruleId].theval = 0;
      console.log('ERROR: Alert for type ' + typeObj._id + ' prop=' + prop + ' with vtype="' + vtype);
      console.log('ERROR: => Invalid theval: ' + util.inspect(typeObj.alerts[prop][ruleId]));
    }
  });
}

function updateProps(typeObj, newprops) {
  if (!typeObj || !newprops) return;

  // Объект props содержит описание свойств - его полностью берем
  typeObj.props = hut.clone(newprops);
  typeObj.proparr = []; // cвойства-значения
  typeObj.commands = []; // cвойства-команды
  typeObj.calc = [];

  Object.keys(typeObj.props).forEach(prop => {
    // alerts

    //
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

// Обработчики верхнего уровня
function fillHandlerObj(typeObj, event, usage) {
  const typeId = typeObj._id;
  const filename = usage ? handlerutil.getHandlerFilename(typeId, event) : '';
  return { filename, fn: '', blk: typeObj['err' + event] ? 1 : 0 };
}

function fillPropHandlerObj(typeObj, prop) {
  // propItem.fuse: 0-обработчик не используется, 1-default, 2-внешний (из файла)
  const typeId = typeObj._id;
  const propItem = typeObj.props[prop];
  if (!propItem) {
    console.log('ERROR: fillPropHandlerObj not found ' + prop + ' in typeObj=' + util.inspect(typeObj));
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
    if (filename) sys = 0;
  }
  return { name, filename, fn: '', blk: propItem.errstr ? 1 : 0, sys };
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
    if (filename) sys = 0;
  }
  return { name, filename, fn: '', blk: propItem.errstr_format ? 1 : 0, sys };
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
  const res = { _id: typeObj._id };

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
  updateAlerts,
  getProparrAux,
  changeFlatFields,
  updateOneAlert,
  extract
};
