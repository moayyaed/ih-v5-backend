/**
 * sceneutils.js
 */

const util = require('util');
// const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');
const parsing = require('./parsing');

const ROOT = 'scenegroup';
const MSROOT = 'multiscenegroup';

/** sync
 *  Синхронизация папки со скриптами и таблиц скриптов
 *    Выполняется дважды: для scenes и multiscenes
 *   - Если в таблице нет - ПРОПУСТИТЬ
 *   - Если в таблице есть - проверить, что существует в req. Cравнить даты, при необходимости перегенерир
 *     При перегенерации заполняются поля devs, triggers, realdevs, def
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая (unget)
 *
 * Результат: массив записей для измененения в таблице scene (multiscene)
 *
 * @param {Array of objects} sceneDocs - записи в таблице
 * @result {Array} массив записей - [{doc:{_id,.. $set:{}}}, ...]
 *         Элемент м б пустая строка - если не изменился сценарий
 */
async function sync(sceneDocs, opt) {
  let changeDocs;
  const multi = opt && opt.multi ? 1 : 0;

  try {
    // Отфильтровать: сценарии - это листы, мультисценарии - папки!
    const promises = sceneDocs.filter(doc => isScriptDoc(doc, multi)).map(doc => verifyScene(doc._id, doc));
    changeDocs = await Promise.all(promises);
  } catch (e) {
    console.log('ERROR: sceneutil.sync ' + util.inspect(e));
  }

  console.log('SCENES changeDocs ' + util.inspect(changeDocs));
  return changeDocs;
}

function isScriptDoc(doc, multi) {
  if (!doc) return;
  return multi ? doc.folder && doc._id != MSROOT : !doc.folder;
}

function isCallDoc(doc, multi) {
  if (!doc) return;
  return !doc.folder;
}

// Проверить, что
// - существует файл script
// - существует файл req
// - время файла script < время файла req (так как он всегда пересоздается после редактирования)
// Сначала проверить время, req создавать только если время <
async function verifyScene(sceneId, doc) {
  const file_scr = appconfig.getScriptFilename(sceneId);
  const ts_scr = await fut.getModifyTimeMsP(file_scr);
  if (!ts_scr) return updateWhenMissingScriptFile(sceneId, doc);

  const file_req = appconfig.getReqScriptFilename(sceneId);
  const ts_req = await fut.getModifyTimeMsP(file_req);

  return ts_req < ts_scr ? updateScene(sceneId, doc) : '';
}

async function processScriptFile(sceneId, opt) {
  const result = {};
  try {
    const scriptStr = await fut.readFileP(appconfig.getScriptFilename(sceneId));

    const sceneObj = processScriptStr(scriptStr, opt); // Обрабатывает скрипт, создает новый req
    if (!sceneObj.reqScript) throw { message: 'Script was not generated!' };

    await fut.writeFileP(appconfig.getReqScriptFilename(sceneId), sceneObj.reqScript);
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
 *  @return {Object} - {name, version, reqScript}
 *
 *  @throw -  если ошибка при парсинге или не найден раздел script
 */
function processScriptStr(scriptStr, opt) {
  const result = {};
  if (!scriptStr) throw { message: 'Empty script!' };

  const parseResult = parsing.selectCommentDescriptAndScript(scriptStr);
  // const { comment, descript, scriptstr } = selectCommentDescriptAndScript(scriptStr);
  if (parseResult.comment) {
    Object.assign(result, parsing.parseComment(parseResult.comment)); // name, version
  }
  if (!parseResult.scriptstr) throw { message: 'Not found "script" clause' };

  if (parseResult.descript) {
    Object.assign(result, parsing.parseDevice(parseResult.descript), opt); // {multi, devs, triggers, realdevs, def};
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
  if (!doc || !doc.reqts) return true;
  // return Math.round(fs.statSync(appconfig.getScriptFilename(sceneId)).mtimeMs) - doc.reqts > 0;
  return fut.getModifyTimeMs(appconfig.getScriptFilename(sceneId)) - doc.reqts > 0;
}

async function createNewScriptFromTemplate(sceneId) {
  return createScriptFile(sceneId, getScriptTemplate());
}

async function createScriptFile(sceneId, scriptStr) {
  return fut.writeFileP(appconfig.getScriptFilename(sceneId), scriptStr);
}

function removeScriptFile(sceneId) {
  fut.delFileSync(appconfig.getScriptFilename(sceneId));
}

// Скрипт в папке script пропал - просто сбросить все поля в записи. req удалить. Состояние=2 - заблокировано
function updateWhenMissingScriptFile(sceneId) {
  const filename = appconfig.getReqScriptFilename(sceneId);
  fut.delFileSync(filename);
  const unsetObj = { multi: 1, devs: 1, triggers: 1, realdevs: 1, def: 1 };
  return {
    doc: { _id: sceneId, $set: { unget: 1, status: 2, err: 1, errstr: 'Script not found!' }, $unset: unsetObj }
  };
}

async function updateScene(sceneId, doc) {
  console.log('updateScene START');
  const multi = doc.multi || 0;
  const setObj = await processScriptFile(sceneId, { multi });
  if (!setObj.err) {
    setObj.unget = 0;
    setObj.err = 0;
    setObj.errstr = '';
  } else setObj.status = 2; // Если ошибка - блокировать сценарий
  return { doc: { ...doc, $set: setObj } };
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
  sync,
  isScriptDoc,
  isCallDoc,
  verifyScene,
  updateScene,
  processScriptFile,
  processScriptStr,
  createNewScriptFromTemplate,
  createNewSceneFromFile,

  removeScriptFile,
  updateWhenMissingScriptFile,
  isScriptFileUpdated,
  formReqScript
};
