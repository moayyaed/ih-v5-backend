const util = require('util');

const hut = require('../utils/hut');

/** selectCommentDescriptAndScript
 * Выделить в скрипте комментарий, блок описания и непосредственно сам скрипт
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
      scriptstr = hut.allTrim(str.substr(j));
      str = str.substr(0, j - 1);
    } else {
      j = str.search(/const\s+script\s*=\s*\{/);
      if (j >= 0) {
        scriptstr = hut.allTrim(str.substr(j));
        str = str.substr(0, j - 1);
      }
    }

    // Внутри startOnChange - собрать??
    descript = hut.allTrim(str);
  } catch (e) {
    console.log(
      'ERROR ' + util.inspect(e) + ' input:' + astr + ' J=' + j + ' typeof str=' + typeof str + util.inspect(str)
    );
  }
  // while (result = regexp.exec(str)) {

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
      if (arr[i] && arr[i].indexOf('@desc') >= 0) {
        result.description = arr.slice(i + 1).join(' ');
        break;
      }
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

/** formReqScript
 * Формирует код модуля сценария, который будет вызываться через require, оборачивая пользовательский объект скрипта
 *
 * @param {String} str  - код скрипта пользовательского сценария: const script = {} или script({})
 * @param {Array} devs - массив имен формальных устройств
 * @param {String} check - строка с условным выражением - второй параметр startOnChange
 *
 * @return {String} - возвращает строку модуля
 * @throw - возбуждает исключение, если script не найден ни в одном из вариантов
 *
 *  Примечание: .* c \n не работает! Вместо .* используется [\s\S]
 */
function formReqScript(astr, devs, check) {
  let str = hut.allTrim(astr);
  if (!str) return;

  const params = [...devs, 'global'];
  const devstr = '{' + params.join(',') + '}';

  str = transformScriptStr(str, check);
  return 'module.exports = function (' + devstr + ') {\n ' + str + '\n return script;\n}';
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

/** 
* Разбор строк:  const Lamp = Device("ActorD","Светильник") - шаблон scenecall
* Разбор строк:  const Lamp = Device("Lamp1") - конкретное устройство
* В любом случае записать в devs - это параметры для запуска скрипта
* в realdevs - пишем только конкретные устройства
* в triggers - пишем устройства-триггеры, если DeviceT вместо Device
* Возвращает флаг, что имеются шаблоны устройств
* Если есть параметры устройства - пишет в devparobj;
*/
function parseDescript(astr) {
  let paramlist = false;
  const regexp1 = /startOnChange([^)]*)/g;

  let res;
  const starts = [];
  while (res = regexp1.exec(astr)) {
    console.log(util.inspect(res));
    starts.push(res[1]);
  }

  const regexp2 = /const\s*([^)]*)/g;
  const consts = [];
  while (res = regexp2.exec(astr)) {
    console.log(util.inspect(res));
    consts.push(res[1]);
  }
console.log('consts  ='+util.inspect(consts));
console.log('starts ='+util.inspect(starts));

  /*
  str.split('const').forEach(oneConst => {
    if (oneConst) {
      // let arr = oneConst.match(/(\w+)\s*=\s*Device\s*\(([^)]*)/);
      let arr = oneConst.match(/(\w+)\s*=\s*(Device\w*)\s*\(([^)]*)/);
      if (arr) {
        if (arr.length != 4 || (arr[2] != 'Device' && arr[2] != 'DeviceT')) {
          throw { message: 'Invalid: const ' + oneConst + '. Only dev=Device(..)  or dev=DeviceT(..) expected!' };
        }

        // Параметры внутри Device
        // Последний аргумент м б JSON для параметров - ищем сначала его
        let i = indexOfObj(arr[3]);
        if (i > 0) {
          devext[arr[1]] = arr[3].substr(i);
          arr[3] = arr[3].substr(0, i);
        }
        */
        // let devparams = arr[3].split(/\s*,\s*/);
        /*
        if (!devparams || devparams.length < 1) throw { message: 'Invalid Device parameters:  ' + arr[3] };

        devs.push(arr[1]);
        if (arr[2] == 'DeviceT') triggers.push(arr[1]);

        let param1 = hut.removeBorderQuotes(devparams[0]);

        if (devo.Device.isClass(param1)) {
          paramlist = true;
          def[arr[1]] = { cl: param1, note: devparams.length > 1 ? hut.removeBorderQuotes(devparams[1]) : param1 };
        } else {
          def[arr[1]] = param1;
          realdevs.push(param1);
        }
      }
    }
  });
  */
  return paramlist;
}

module.exports = {
  selectCommentDescriptAndScript,
  parseComment,
  parseDescript,
  formReqScript
};
