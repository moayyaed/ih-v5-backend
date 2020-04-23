/**
 * parsing.js
 */

const util = require('util');

const hut = require('../utils/hut');

/** 
 * Выделить в скрипте комментарий, блок описания и непосредственно сам скрипт
 * 
 */
function selectCommentDescriptAndScript(astr) {
  // Файл должен начинаться с обязательного комментария /* */, из него берется описание
  // Все, что выше первого комментария, игнорируется
  let str = astr;
  let comment = '';
  let descript = '';
  let scriptstr = '';
  let j;
  try {
    j = str.indexOf('*/');
    if (j >= 0) {
      // console.log(' selectComment j= '+j+' str='+str);
      comment = hut.allTrim(str.substr(0, j - 1)); // */ не нужен
      str = hut.allTrim(str.substr(j + 2));
    }

    // script - БЫЛИ возможны 2 варианта синтаксиса:
    //  const script = {..}  или script({...})
    // второй - новый
    j = str.search(/script\s*\(\s*\{/);
    if (j >= 0) {
      scriptstr = str.substr(j);
      str = str.substr(0, j - 1);
    } else {
      j = str.search(/const\s+script\s*=\s*\{/);
      if (j >= 0) {
        scriptstr = str.substr(j);
        str = str.substr(0, j - 1);
      }
    }

    // Убираем ведущие концевые пробелы и ; в конце если есть
    scriptstr = trim(scriptstr);
    descript = trim(str);
  } catch (e) {
    console.log(
      'ERROR ' + util.inspect(e) + ' input:' + astr + ' J=' + j + ' typeof str=' + typeof str + util.inspect(str)
    );
  }
  
  return { comment, descript, scriptstr };
}

function parseComment(comment) {
  const result = {};
  comment.split('\n').forEach(str => {
    let arr = str.split(/\s+/);
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].indexOf('@name') >= 0) {
        result.name = arr.slice(i + 1).join(' ');
        break;
      }
      /*
      if (arr[i] && arr[i].indexOf('@desc') >= 0) {
        result.description = arr.slice(i + 1).join(' ');
        break;
      }
      */
      if (arr[i] && arr[i].indexOf('@plugin') >= 0) {
        result.plugin = arr.slice(i + 1).join(' ');
        break;
      }
      if (arr[i] && arr[i].indexOf('@version') >= 0) {
        result.version = arr.slice(i + 1).join(' ');
        break;
      }
    }
  });
  return result;
}

/**
 * Разбор строк:  const Lamp = Device("ActorD","Светильник") - шаблон scenecall
 * Разбор строк:  const Lamp = Device("Lamp1") - конкретное устройство
 * В любом случае записать в devs - это параметры для запуска скрипта
 * в realdevs - пишем только конкретные устройства
 * в triggers - пишем устройства-триггеры, если DeviceT вместо Device
 * Возвращает флаг, что имеются шаблоны устройств
 * Если есть параметры устройства - пишет в devparobj;
 *  @return 
 *  @throw в случае ошибки при разборе
 */
function parseDevice(astr) {
  let multi = 0;
  const devs = []; // формальные параметры - имена const
  const triggers = []; // триггеры - среди формальных
  const realdevs = []; // реальные устройства - из правой части
  const def = {}; // объект: {sensor:'D1'} или {sensor:{cl:'SensorD', note:'датчик'}}

  const consts = extractConst(astr); // const lamp = Device(...)
  consts.forEach(str => {
    const { formalDevice, param1, trig, args } = parseConst(str);

    devs.push(formalDevice);
    if (trig) triggers.push(formalDevice);

    if (isClass(param1)) {
      multi = 1;
      def[formalDevice] = { cl: param1, note: args.length > 0 ? hut.removeBorderQuotes(args[0]) : param1 };
    } else {
      def[formalDevice] = param1;
      realdevs.push(param1);
    }
  });

  const { triggerStr, checkStr } = processStartOnStr(astr);
  return {
    multi,
    devs: devs.join(','),
    triggers: triggerStr || triggers.join(','),
    realdevs: realdevs.join(','),
    checkStr,
    def
  };
}

function extractConst(astr) {
  const consts = [];
  const regexp = /const\s*([^)]*)/g;

  let res = true;
  while (res) {
    res = regexp.exec(astr);
    if (res) consts.push(res[1]);
  }
  return consts;
}

function parseConst(str) {
  const invC = '. Only "const dev=Device(..)"  or "const dev=DeviceT(..)" expected!';

  const arr = str.split(/\s*=\s*/);
  if (!arr || arr.length != 2 || !arr[1].startsWith('Device')) throw { message: 'Invalid const: ' + str + invC };

  const formalDevice = arr[0];

  const n = arr[1].startsWith('DeviceT') ? 7 : 6;

  // Заднюю скобочку уже отделили, найти открывающую, разбить по запятым
  let argstr = hut.allTrim(arr[1].substr(n));
  if (!argstr || argstr.length < 2 || argstr[0] != '(') throw { message: 'Invalid const: ' + str + invC };
  const args = argstr.substr(1).split(',');
  if (!args || argstr.length < 1) throw { message: 'Invalid const: ' + str + ' Empty Device args!' };

  const param1 = hut.removeBorderQuotes(args[0]);
  args.shift();
  return { formalDevice, param1, trig: n == 7, args };
}

function isClass(str) {
  return ['SensorD', 'SensorA', 'ActorD', 'ActorA', 'ActorE', 'Meter'].includes(str);
}

/**
 * Обработка раздела startOnChange:
 *
 *  Выделить триггеры и условное выражение
 *
 * @param {String} str - входящая строка : 'startOnChange([lamp,temp], lamp.auto&&(temp.value<20))';
 * @return {Object}- {triggerStr:'lamp,temp', checkStr:'lamp.auto&&(temp.value<20)'}
 *          {} - если во входящей строке нет startOnChange
 *
 * @throw - возбуждает исключение, если startOnChange без скобочек
 *
 */
function processStartOnStr(str) {
  // Пока считаем, что только startOnChange();
  // При успешном разборе должны вернуть массив из 2 строк['lamp, temp', 'lamp.auto && temp.value>2']

  let j = str.search(/startOnChange/);
  if (j < 0) return {}; // Просто нет

  // Может быть оформлено с переносами на несколько строк - удаляем
  str = removeCR(str);

  // Если есть - пытаемся выделить аргументы
  let arr = /startOnChange\s*\((.*)\)/.exec(str);

  // arr[1] содержит захваченную строку
  if (!arr || !arr[1]) throw new Error('Expected "startOnChange()" definition! Invalid "' + str + '"');
  let str1 = arr[1];

  // Первый аргумент м б в [], а может и без
  // startOnChange([lamp,temp], lamp.auto) или startOnChange(lamp, lamp.auto)
  let par1 = '';
  let par2 = '';
  let par1arr = /^\s*\[(.*)\]/.exec(str1);
  if (!par1arr) {
    // Тогда до запятой
    par1arr = /^\s*(.*),/.exec(str1);
  }

  if (par1arr) {
    // Захваченная группа
    par1 = par1arr[1];

    // остальное - второй аргумент
    par2 = str1.substr(par1arr[0].length + 1);
  } else par1 = str1; // Если запятой нет совсем - значит, есть только первый аргумент

  // В списке устройств удаляем все пробелы
  par1 = par1.replace(/\s+/g, '');

  // В условии удаляем крайние пробелы
  if (par2) par2 = hut.allTrim(par2);

  return { triggerStr: par1, checkStr: par2 || '' };
}

function transformScriptStr(astr, check) {
  let str = astr;

  // Варианты:
  // const script = {} - Старый вариант - берем как есть
  // script({}) - Ноый - преобразуем в const script = {}
  if (str.substr(0, 6) == 'script') {
    // Вытащим {}
    const arr = /script\s*\(\s*(\{[\s\S]*\})\s*\)$/.exec(str);
    if (!arr || arr.length < 2) {
      throw new Error('Expected "script({...}) or const script = {}"');
    }

    // Если есть check- выражение в виде строки - включим его внутрь скрипта
    // Это нужно только для новой версии
    str = arr[1];
    if (check) {
      str = '{\n check() { return ' + check + '},\n' + str.substr(1); // первую { заменяем на это
    }
    str = 'const script = ' + str;
  }

  // Проверяем результат
  if (str.search(/const\s+script\s*=\s*\{[\s\S]*\}$/) != 0) {
    throw new Error('Expected "const script = {...}"');
  }
  return str;
}
function trim(str) {
  // Удалить пробелы до и после
  str = hut.allTrim(str);
  if (!str) return '';

  // Удалить ; в конце
  if (str[str.length - 1] == ';') str = str.substr(0, str.length - 1);
  return str;
}

function removeCR(str) {
  return str.replace(/[\n\r]/g, '');
}

module.exports = {
  selectCommentDescriptAndScript,
  parseComment,
  parseDevice,
  transformScriptStr
};
