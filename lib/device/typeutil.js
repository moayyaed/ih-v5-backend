/**
 * typeutil.js
 *
 */

const appconfig = require('../appconfig');
const defaulthandlers = require('./defaulthandlers');

function implementHandler(prop, p) {
  try {
    if (p.fname && !isDefHandler(p.fname)) {
      // Внешний обработчик?
      const filename = appconfig.getHandlerFilenameIfExists(p.fname);
      if (filename) {
        p.fn = require(filename);
        return;
      }
    }

    if (!p.fn) {
      // Дефолтный обработчик, может быть привязан либо нужно его определить?
      if (!p.fname) p.fname = getDefHandlerName(prop, p);
      if (p.fname) p.fn = defaulthandlers[p.fname];
    }
  } catch (e) {
    // ???
    p.fname = '';
    p.fn = '';
    console.log('implementHandler ERROR for prop ' + prop);
  }
}

function isDefHandler(fname) {
  return fname.startsWith('def_');
}

function getDefHandlerName(prop, { vtype, op }) {
  switch (op) {
    case 'rw':
    case 'par':
      return 'def_rw_' + vtype; // def_rw_N,..

    case 'cmd':
      return 'def_cmd_' + prop; // def_cmd_on
    default:
      return '';
  }
}


function getProparrAux(prop, propItem) {
  // const res = { prop };
  if (!propItem || propItem.command) return;

  const res = {};

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

  return res;
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

  // const props = typeMap.get(typeId).props;
  console.log('showHandlers props=');
  Object.keys(props).forEach(prop => {
    if (props[prop].fn) {
      const module = props[prop].fname || 'Default';
      str += '/** Свойство: ' + prop + ',  module: ' + module + ' **/\n' + props[prop].fn.toString() + '\n\n';
    }
  });
  return str;
}

module.exports = {
  implementHandler,
  getProparrAux,
  getShowHandlersStr
};
