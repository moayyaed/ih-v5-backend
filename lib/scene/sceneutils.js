/**
 * sceneutils.js
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const parsing = require('./parsing');

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
        // changeDocs.push({ doc: Object.assign(doc, { $set: { unget: 1, errstr: 'Script not found!' } }) });
        changeDocs.push(missingScriptFile(doc._id));
      }
    });
  } catch (e) {
    console.log('Error syncScripts ' + util.inspect(e));
  }
  return changeDocs;
}

async function processScriptFile(sceneId) {
  const result = {};
  try {
    const scriptStr = await readScriptFile(sceneId);
    const sceneObj = processScriptStr(scriptStr, sceneId); // Обрабатывает скрипт, создает новый req
    if (!sceneObj.reqScript) throw { message: 'Script was not generated!' };

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

/** processScript
 *
 *  @param {String} scriptStr - Строка из файла script/*.js
 *  @param {String} sceneId - Id сценария (имя файла)
 *  @return {Object} - {name, version, }
 *
 *  @throw -  если ошибка при парсинге или не найден раздел script
 */
function processScriptStr(scriptStr, sceneId) {
  const result = {};
  const parseResult = parsing.selectCommentDescriptAndScript(scriptStr);
  // const { comment, descript, scriptstr } = selectCommentDescriptAndScript(scriptStr);
  if (parseResult.comment) {
    Object.assign(result, parsing.parseComment(parseResult.comment)); // name, version
  }
  if (!parseResult.scriptstr) throw { message: 'Not found "script" clause' };

  if (parseResult.descript) {
    Object.assign(result, parsing.parseDevice(parseResult.descript)); // {multi, devs, triggers, realdevs, def};
  }
  // Подготовить код для req
  result.reqScript = formReqScript(parseResult.scriptstr, result.devs);

  return result;
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
  return { new: 1, _id: sceneId, status: '0', name: sceneId, parent: ROOT, ...result };
}

/** formReqScript
 * Формирует код модуля сценария, который будет вызываться через require, оборачивая пользовательский объект скрипта
 *
 * @param {String} str  - код скрипта пользовательского сценария: const script = {} или script({})
 * @param {Array} devs - массив имен формальных устройств
 * @param {String} check - строка с условным выражением - второй параметр startOnChange
 *                  TODO - check проверять не внутри, а на подходе??
 *
 * @return {String} - возвращает строку модуля
 * @throw - возбуждает исключение, если script не найден ни в одном из вариантов
 *
 *  Примечание: .* c \n не работает! Вместо .* используется [\s\S]
 */
function formReqScript(astr, devStr) {
  let str = hut.allTrim(astr);
  if (!str) return;
  const devs = devStr ? devStr.split(',') : [];
  const params = [...devs, 'global'];
  const devstr = '{' + params.join(',') + '}';

  str = parsing.transformScriptStr(str);
  return 'module.exports = function (' + devstr + ') {\n ' + str + '\n return script;\n}';
}

function isScriptFileUpdated(sceneId, doc) {
  if (!doc.reqts) return true;
  return Math.round(fs.statSync(appconfig.getScriptFilename(sceneId)).mtimeMs) - doc.reqts > 0;
}

async function readScriptFile(sceneId) {
  return fs.promises.readFile(appconfig.getScriptFilename(sceneId), 'utf8');
}

async function copyScriptFile(fromId, toId) {
  const scriptStr = await fs.promises.readFile(appconfig.getScriptFilename(fromId), 'utf8');
  return createScriptFile(toId, scriptStr);
}

async function createNewScriptFromTemplate(sceneId) {
  return createScriptFile(sceneId, getScriptTemplate());
}

async function createScriptFile(sceneId, scriptStr) {
  return fs.promises.writeFile(appconfig.getScriptFilename(sceneId), scriptStr, 'utf8');
}

// Скрипт в папке script пропал - просто сбросить все поля в записи. req удалить
function missingScriptFile(sceneId) {
  const filename = appconfig.getReqScriptFilename(sceneId);
  fs.unlink(filename, err => {
    if (err) {
      if (err.code != 'ENOENT') console.log('Error unlink file:' + filename + util.inspect(err));
    }
  });

  const unsetObj = { multi: 1, devs: 1, triggers: 1, realdevs: 1, def: 1 };
  return { _id: sceneId, $set: { unget: 1, state: 0, err: 1, errstr: 'Script not found!' }, $unset: unsetObj };
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
  return { ...doc, $set: setObj };
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

module.exports = {
  syncScripts,
  processScriptFile,
  processScriptStr,
  createNewScriptFromTemplate,
  createNewSceneFromFile,
  verifyUpdateScene,
  updateScene,
  missingScriptFile,
  copyScriptFile,
  isScriptFileUpdated,
  formReqScript
};
