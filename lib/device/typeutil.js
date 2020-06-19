/**
 * typeutil.js
 * 
 */

function getDefaultCommandFun(vtype, op, prop) {
  // if (op != 'w') return '';
  if (prop == 'on') {
    return function(device) {
      device.set('value', 1);
    };
  }
  if (prop == 'off') {
    return function(device) {
      device.set('value', 0);
    };
  }
  if (prop == 'toggle') {
    return function(device) {
      if (device.value) {
        device.on();
      } else {
        device.off();
      }
    };
  }
}

function getDefaultReadFun(vtype, op) {
  if (op == 'w') return ''; // Чтения нет

  if (op == 'c') {
    // calculate
    return function(device) {
      return device.value ? 1 : 0;
    };
  }
  if (vtype == 'N') {
    return function(device, prop, value) {
      if (isNaN(value)) return { error: 'Not a number: ' + value };
      const newvalue = device.getRounded(prop, value);
      return device.inRange(prop, newvalue) ? newvalue : { error: 'Out of range!', value: newvalue };
    };
  }

  if (vtype == 'B') {
    return function(device, prop, value) {
      return value == 0 || value == 1 ? Number(value) : { error: 'Expected boolean! Invalid ' + value };
    };
  }

  if (vtype == 'S') {
    return function(device, prop, value) {
      return typeof value == 'object' ? JSON.stringify(value) : String(value);
    };
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
 
  let str = '/**  В этом окне функции показаны только для просмотра.\n\r';
  str += '*    Функция onGet срабатывает при получении данных\n\r';
  str += '*    Для замены Default обработки для свойства выберите другую функцию в графе При получении значения\n';
  str += '*    Изменить функцию или создать новую  можно в разделе Функции-обработчики\n';
  str += '* \n';
  str += '*    Функция onCommand срабатывает при  вызове команды (свойства c операцией Command) \n\r';
  str +=
    '*    Для свойств-команд on,off,toggle существует Default функция, реализующая команду через свойство "value" \n';
  str += '*    Для нестандартных команд нужно задать свою функцию в графе Выполнение команды \n';
  str += '* \n';
  str += '*    Для свойств с операциями RW можно задать функцию onSet, которая запускается При отправке данных\n';
  str += '*    Default обработки в этом случае не существует\n';
  str += '* \n';

  str += '*/\n\n';

  // const props = typeMap.get(typeId).props;
  console.log('showHandlers props=');
  Object.keys(props).forEach(prop => {
    if (props[prop].readfun) {
      const module = props[prop].onread || 'Default';
      str += '/** onGet: ' + prop + ',  module: ' + module + ' **/\n' + props[prop].readfun.toString() + '\n\n';
    }
    if (props[prop].commandfun) {
      const module = props[prop].oncommand || 'Default';
      str +=
        '/** onCommand: ' + prop + ',  module: ' + module + ' **/\n' + props[prop].commandfun.toString() + '\n\n';
    }
  });
  return str;
}

module.exports = {
  getDefaultCommandFun,
  getDefaultReadFun,
  getProparrAux,
  getShowHandlersStr
}