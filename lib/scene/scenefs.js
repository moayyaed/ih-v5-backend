/**
 *  scenefs.js
 *  Работа с файлами сценариев
 *   Для каждого сценария
 *  - Папка script содержит файл, который редактируется
 *  - Папка req содержит файл, который будут запускаться через require.
 *     Он генерируется из скрипта - делается обертка, подставляются параметры
 *     При замене скрпита нужно делать unreq, так как модули кэшируются
 *
 *  - Таблица scenes содержит записи о сценариях:
 *   {_id:sceneId, name:'Текст для показа в дереве и списках', parent:ROOOTPARENT,
 *    state:(0-development, 1-work, 2-blocked),
 *    // Дальше поля служебные, устанавливаются программой
 *    reqts: // Время создания файла req
 *    multi:1/0, devs:'Список устройств (Device)', triggers:'Список триггеров',
 *
 *    err:1/0,
 *    errstr:'',
 *    unset:1/0 - файл сценария не найден
 *   }
 */
const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const sceneutils = require('./sceneutils');

const ROOOTPARENT = 'scenegroup';

/** syncScripts
 *  Синхронизация папки со скриптами и таблицы скриптов
 *   - Если в таблице нет - добавить запись, создать файл в папке req
 *   - Если в таблице есть - проверить, что существует в req. Cравнить даты, при необходимости перегенерир
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая в файле??
 *
 * Результат: массив записей для добавления и измененения в таблице
 *
 * @param {Array of objects} sceneDocs - записи в таблице scenes
 * @result {Array} массив записей - [{new:true, doc:{}}, {doc:{_id,.. $set:{}}}]
 */
async function syncScripts(sceneDocs) {
  let changeDocs;
  try {
    const fileNames = await fs.promises.readdir(appconfig.getScriptPath());
    const scriptNames = fileNames.filter(el => el.endsWith('.js')).map(el => el.substr(0, el.length - 3));

    const sceneDocsObj = hut.arrayToObject(sceneDocs, '_id');

    const promises = scriptNames.map(name =>
      !sceneDocsObj[name] ? createNewSceneFromFile(name) : verifyUpdateScene(name, sceneDocsObj[name])
    );
    changeDocs = await Promise.all(promises);

    // Проверить, что записи таблицы есть в папке. Если нет - пометить как отсутствующий сценарий
    sceneDocs.forEach(doc => {
      if (!scriptNames.includes(doc._id)) {
        changeDocs.push({ doc: Object.assign(doc, { $set: { unget: 1, errstr: 'Script not found!' } }) });
      }
    });
  } catch (e) {
    console.log('Error syncScripts ' + util.inspect(e));
  }
  return changeDocs;
}

/**
 * Создает новый сценарий на основании файла из папки
 * @param {String} name
 * @return {Object} - {new:true, doc}  doc - запись для таблицы
 */
async function createNewSceneFromFile(sceneId) {
  const result = { _id: sceneId, status:"0", name: sceneId, parent: ROOOTPARENT };
  try {
    const scriptStr = await readScriptFile(sceneId);
    console.log('createNewSceneDoc(sceneId ' + sceneId);
    const parseResult = sceneutils.selectCommentDescriptAndScript(scriptStr);
    // const { comment, descript, scriptstr } = sceneutils.selectCommentDescriptAndScript(scriptStr);
    if (parseResult.comment) {
      Object.assign(result, sceneutils.parseComment(parseResult.comment)); // name, version
    }
    if (!parseResult.scriptstr) throw { message: 'Not found "script" clause' };

    // Разобрать
    // Создать req  файл
    result.reqts = Date.now();

    // Нужно еще флаг - мульти или обычный.
    // И разобрать и подготовить триггеры
  } catch (e) {
    result.err = 1;
    result.errstr = 'Error: ' + (e.message || e.code);
  }
  return { new: 1, doc: result };
}

async function verifyUpdateScene(name, doc) {
  const setObj = {};
  if (doc.unget) {
    setObj.unget = 0;
    setObj.errstr = '';
  }

  // Сначала проверить время, req создавать только если время <

  return !hut.isObjIdle(setObj) ? { doc: Object.assign(doc, { $set: setObj }) } : ''; // Изменения не нужны
}

async function readScriptFile(sceneId) {
  return fs.promises.readFile(appconfig.getScriptFilename(sceneId), 'utf8');
}

async function copyScript(fromId, toId) {
  const scriptStr = await fs.promises.readFile(appconfig.getScriptFilename(fromId), 'utf8');
  return createScript(toId, scriptStr);
}

async function createNewScriptFromTemplate(sceneId) {
  return createScript(sceneId, getScriptTemplate());
}

async function createScript(sceneId, scriptStr) {
  return fs.promises.writeFile(appconfig.getScriptFilename(sceneId), scriptStr, 'utf8');
}

function getScriptTemplate() {
  return `
  /** 
* @name Новый сценарий 
* @desc  
* @version 4 
*/

// const motion = Device("MOTION1"); 
// const lamp = Device("LAMP1"); 

// startOnChange(motion); 

script({
    start() {
        // if (motion.isOn()) lamp.on(); 
        // if (motion.isOff()) lamp.off(); 
    } 
});
`;
}

/**
 * Обрабатывает строку с исходным скриптом сценария:
 * 1. Считывает name, desc, version из комментария
 * 2. Создает файл req, если не создан. Создает новую запись в scenedef???
 * 3. Создает и возвращает запись для scenes: {id, scene, name, desc, version }
 *
 * @param {String} sceneId
 *
 * @return {Object} - запись для виртуальной таблицы scenes
 * Генерирует исключение в случае ошибки
 */
/*
function processScriptFile(sceneId, rebuild, houser, result = {}) {
  Object.assign(result, { id: sceneId, scene: sceneId, name: sceneId, err: '' }); // запись scenes

  

  
  let j = scriptutils.searchMainCommentEnd(scriptStr);
  parseComment(scriptStr.substr(0, j));
  scriptStr = scriptStr.substr(j + 2);

  let devs = []; // const Lamp = Device("ActorD","Светильник")
  let realdevs = []; // const Lamp1 = Device("Lamp1")
  let triggers = []; // const Lamp1 = DeviceT("Lamp1")
  let def = { id: sceneId, scene: sceneId }; // запись scenedef {}
  let devext = {}; // для каждого устр-ва м б свои параметры: {lamp:'{prop:time2,...}'}
  let checkStr;

  const reqfile = houser.getReqScriptFilename(sceneId);
  if (rebuild || !fs.existsSync(reqfile)) {
    // Разделить Device и  script разделы
    // Данные Device обработать, script записать в файл
    let reqScriptStr = getReqScriptStr(scriptStr, result.version);

    // Формируем скрипт
    fs.writeFileSync(reqfile, scriptutils.formReqScript(reqScriptStr, devs, checkStr), 'utf8');

    // 1. ОБработка данных Device. Уст result.err, если ошибка устройства или мульти и реал одновременно
    checkRealdevs();

    // 2. Доп св-ва пишем в sceneext
    if (!result.err) updateSceneext();

    // 3. Пишем scenedef
    //    для мульти: если изменился список формальных параметров - изменить записи в scenecall
    if (!result.err) updateScenedefAndScenecall();

    // showdevs - здесь только реальные устр-ва
    result.showdevs = result.realdevs ? result.realdevs.join(',') : '';
    result.triggers = triggers.length > 0 ? triggers : '';
    result.triggerstr = triggers.length > 0 ? triggers.join(',') : '';
  }

  function getReqScriptStr(str, version) {
    let resStr = str;
    let startOnStr;

    let pos = scriptutils.searchScriptPos(str, version);
    if (pos > 1) {
      // Скрипт отделяем
      resStr = str.substr(pos);
      str = str.substr(0, pos - 1);

      // Должны быть Device и м б startOn для новой версии
      pos = scriptutils.searchStartOn(str, version);
      if (pos >= 0) {
        startOnStr = str.substr(pos);
        str = str.substr(0, pos - 1);
      }

      // Device
      result.hasCl = parseDevice(str);

      if (startOnStr) {
        let pars = scriptutils.processStartOnStr(startOnStr);
        // Возвращает массив аргументов: [triggers, checkStr]
        if (pars && pars.length > 0) {
          if (pars[0]) {
            triggers = pars[0].split(',');
            // triggers = parseTriggers(pars[0]); // строка в массив
            if (pars[1]) checkStr = pars[1];
          }
        }
      }
    } // else  - кроме скрипта ничего нет - его и надо вернуть

    return resStr;
  }

  function checkRealdevs() {
    if (realdevs.length > 0) {
      result.realdevs = realdevs;
      if (result.hasCl) {
        result.err = 'Real devices OR param devices?';
      } else {
        realdevs.forEach(dn => {
          if (!houser.getDevobj(dn)) result.err = 'Missing device ' + dn;
        });
      }
    }
  }

  function updateSceneext() {
    let extitem;
    if (!hut.isObjIdle(devext)) {
      extitem = { id: sceneId };
      Object.keys(devext).forEach(dev => {
        try {
          let pobj = JSON.parse(devext[dev]);
          if (!util.isArray(pobj)) pobj = [pobj];
          pobj.forEach(item => {
            hut.objMustHaveProps(item, 'name,note,type,val');
          });
          extitem[dev] = pobj;
        } catch (e) {
          result.err = dev + ' Device params: ' + e.message;
        }
      });
      if (!result.err) {
        jdb.update({ name: 'sceneext', payload: [extitem], opt: { replace: 1 } });
        result.hasExt = true;
      }
    }

    // В любом случае пометить на удаление ext свойства этого сценария для всех реальных устройств
    // При создании workscene (sceneserver.onSceneChange)записи добавляются
    // Потом, если свойство для устройства не используется ни одним сценарием - оно удаляется у устройства
    extprops.markUnused({ scene: sceneId });
    //  jdb.replaceAll({name: 'devextprops', filter: { scene: sceneId },replace: { scene: '-' }});
  }

  function updateScenedefAndScenecall() {
    // Cчитать из scenedef прежний список формальных параметров
    let prevDevarr = getFormalDevs(sceneId);
    jdb.update({ name: 'scenedef', payload: [def], opt: { replace: 1 } });

    if (result.hasCl) {
      // Это новый список
      let devsarray = getFormalDevs(sceneId);

      // Если изменился список формальных параметров - изменить записи в scenecall
      if (!hut.isTheSameArray(prevDevarr, devsarray)) {
        changeScenecallActualDevs(sceneId, devsarray);
      }
    }
  }


  // Разбор строк:  const Lamp = Device("ActorD","Светильник") - шаблон scenecall
  // Разбор строк:  const Lamp = Device("Lamp1") - конкретное устройство
  // В любом случае записать в devs - это параметры для запуска скрипта
  // в realdevs - пишем только конкретные устройства
  // в triggers - пишем устройства-триггеры, если DeviceT вместо Device
  // Возвращает флаг, что имеются шаблоны устройств
  // Если есть параметры устройства - пишет в devparobj;
  function parseDevice(str) {
    let paramlist = false;
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

//          let devparams = arr[3].split(/\s*,\s*/);
/*          if (!devparams || devparams.length < 1) throw { message: 'Invalid Device parameters:  ' + arr[3] };

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
    return paramlist;
  }
}
*/

module.exports = {
  syncScripts,
  createNewScriptFromTemplate,
  copyScript
};
