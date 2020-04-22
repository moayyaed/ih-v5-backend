/**
 *  scenefs.js
 *  Работа с файлами сценариев
 *   Для каждого сценария
 *  - Папка script содержит файл, который редактируется
 *  - Папка req содержит файл, который будут запускаться через require.
 *     Он генерируется из скрипта - делается обертка, подставляются параметры
 *     При замене скрипта нужно делать unreq, так как модули кэшируются
 *
 *  - Таблица scenes содержит записи о сценариях:
 *   {_id:sceneId,
 *     name:'Текст для показа в дереве и списках', parent:ROOOTPARENT(def),
 *     state:(0-draft, 1-work, 2-blocked),
 *
 *    // Дальше поля служебные, устанавливаются программой
 *    reqts: // Время создания файла req
 *    multi:1/0,
 *    devs:'Список формальных параметров через ,',
 *    triggers:'Список триггеров через ,',
 *    realdevs:'Список реальных устройств через ,',
 *    def: - вложенный объект - соответствие формальный - фактический параметр.
 *
 *       def:{lamp:'LAMP1',..} для обычного сценария. Используется при вызове сценария
 *       def:{lamp:{cl:'SensorD', note:'Свет'}..} для мульти сценария. Используется для таблички параметров и при вызове сценария
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

const ROOT = 'scenegroup';

/** syncScripts
 *  Синхронизация папки со скриптами и таблицы скриптов
 *   - Если в таблице нет - добавить запись, создать файл в папке req
 *   - Если в таблице есть - проверить, что существует в req. Cравнить даты, при необходимости перегенерир
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая (unget)
 *
 * Результат: массив записей для добавления и измененения в таблице scene
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

/** createNewSceneFromFile
 * Создает новый сценарий на основании файла из папки
 *  - Формирует запись для таблицы, выделяет триггеры, формальные и факт параметры
 *  - Формирует файл в папке req, сохраняет время создания
 * @param {String} sceneId
 * @return {Object} - {new:true, doc}  doc - запись для таблицы
 */
async function createNewSceneFromFile(sceneId) {
  const result = await processScriptFile(sceneId);
  return { new: 1, doc: Object.assign({ _id: sceneId, status: '0', name: sceneId, parent: ROOT }, result) };
}

async function processScriptFile(sceneId) {
  const result = {};
  try {
    const scriptStr = await readScriptFile(sceneId);
    const sceneObj = sceneutils.processScript(scriptStr, sceneId); // Обрабатывает скрипт, создает новый req
    if (!sceneObj.reqScript) throw { message: 'Script was not generated!' };

    console.log('WRITE ' + appconfig.getReqScriptFilename(sceneId));
    await fs.promises.writeFile(appconfig.getReqScriptFilename(sceneId), sceneObj.reqScript, 'utf8');
    delete sceneObj.reqScript;

    Object.assign(result, sceneObj);
    result.reqts = Date.now();
  } catch (e) {
    result.err = 1;
    result.errstr = 'Error: ' + (e.message || e.code);
  }
  return result;
}

async function verifyUpdateScene(sceneId, doc) {
  // Сначала проверить время, req создавать только если время <
  return isScriptFileUpdated(sceneId, doc) ? updateScene(sceneId, doc) : '';
}

async function updateScene(sceneId, doc) {
  const setObj = await processScriptFile(sceneId);
  if (!setObj.err) {
    setObj.unget = 0;
    setObj.err = 0;
    setObj.errstr = '';
  }

  return { doc: Object.assign(doc, { $set: setObj }) };
}

function isScriptFileUpdated(sceneId, doc) {
  if (!doc.reqts) return true;
  return Math.round(fs.statSync(appconfig.getScriptFilename(sceneId)).mtimeMs) - doc.reqts > 0;
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


}
*/

module.exports = {
  syncScripts,
  createNewScriptFromTemplate,
  copyScript
};
