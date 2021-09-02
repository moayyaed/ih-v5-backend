/**
 * sceneutils.js
 */

const util = require('util');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');
const parsing = require('./parsing');

const ROOT = 'scenegroup';

/** sync
 *  Синхронизация папки со скриптами и таблиц скриптов
 *   - Если в таблице нет - ПРОПУСТИТЬ
 *   - Если в таблице есть - проверить, что существует в req. Cравнить даты, при необходимости перегенерир
 *     При перегенерации заполняются поля devs, starttriggers, realdevs, def
 *   - Если в таблице есть, а файла нет, строка не удаляется, а помечается как отсутствующая (unget)
 *
 * Результат: массив записей для измененения в таблице scene
 *
 * @param {Array of objects} sceneDocs - записи в таблице
 * @result {Array} массив записей - [{doc:{_id,.. $set:{}}}, ...]
 *         Элемент массива м б пустая строка - если не изменился сценарий
 */
async function sync(sceneDocs) {
  try {
    const promises = sceneDocs.filter(doc => !doc.folder).map(doc => verifyScene(doc._id, doc));
    const changeDocs = await Promise.all(promises);
    // console.log('SCENES changeDocs ' + util.inspect(changeDocs, null, 4));
    return changeDocs;
  } catch (e) {
    console.log('ERROR: sceneutil.sync ' + util.inspect(e));
  }
}

/** verifyScene
 * Проверить, что
 * - существует файл в папке script
 * - существует файл в папке req
 *   Если время файла в папке req < script или req не существует - создать заново
 *
 * @param {*} sceneId
 * @param {*} doc
 */
async function verifyScene(sceneId, doc) {
  const file_scr = appconfig.getScriptFilename(sceneId);
  const ts_scr = await fut.getModifyTimeMsP(file_scr);
  if (!ts_scr) return updateWhenMissingScriptFile(sceneId, doc);

  const file_req = appconfig.getReqScriptFilename(sceneId);
  const ts_req = await fut.getModifyTimeMsP(file_req);

  return ts_req < ts_scr ? updateScene(sceneId, doc) : '';
}

/** updateScene
 *
 * @param {String} sceneId
 * @param {Object} doc
 *
 * @return {Object}  - объект для изменения в таблице scene
 */
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

/**  processScriptFile
 * Подготовка к использованию сценария после добавления/ редактирования кода
 *  - запускает обработку декларативной части и генерацию файла req
 *  - выполняет require и устанавливает/снимает ошибку
 *  - возвращает атрибуты сценария для записи в таблицу
 *
 * @param {String} sceneId
 * @param {Object} opt
 * @param {String} scriptStr -  строка со скриптом, опционально
 *                              Если нет - считывается из файла в папке script
 *
 * @return {Object}  - объект атрибутов из декларативной части +  err, errstr, reqts
 */
async function processScriptFile(sceneId, opt, scriptStr) {
  const result = {};
  try {
    if (!scriptStr) scriptStr = await fut.readFileP(appconfig.getScriptFilename(sceneId));

    const sceneObj = processScriptStr(scriptStr, opt); // Обрабатывает скрипт, создает новый req
    if (!sceneObj.reqScript) throw { message: 'Script was not generated!' };

    const reqFilename = appconfig.getReqScriptFilename(sceneId);
    hut.unrequire(reqFilename);
    await fut.writeFileP(reqFilename, sceneObj.reqScript);
    delete sceneObj.reqScript;

    // Попробовать require - если ошибка - будет throw, запуск блокируется
    checkScript(reqFilename);

    Object.assign(result, sceneObj, { err: 0, errstr: '' });
    result.reqts = Date.now();
  } catch (e) {
    result.err = 1;
    result.errstr = 'Error: ' + (e.message || e.code);
    result.blk = 1;
  }
  return result;
}

function checkScript(reqFilename) {
  const script = require(reqFilename)({});
  if (!script || typeof script != 'object') throw { message: 'Invalid script, expect object! ' };
  if (!script.start || typeof script.start != 'function') throw { message: 'Invalid script, missing start function ' };
}

/** processScript
 *
 * Обработка кода сценария
 *  - генерация файла req
 *  - формирование атрибутов из декларативной части сценария для записи в таблицу scene
 *
 *  @param {String} scriptStr - Строка из файла script/*.js
 *  @param {String} sceneId - Id сценария (имя файла)
 *
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
    const { name, version } = parsing.parseComment(parseResult.comment); // name не берем, только version
    result.version = version;
    // Object.assign(result, parsing.parseComment(parseResult.comment));
  }
  if (!parseResult.scriptstr) throw { message: 'Not found "script" clause' };

  if (parseResult.descript) {
    Object.assign(result, parsing.parseDevice(parseResult.descript, opt), opt); // {multi, devs, starttriggers, realdevs, def};
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
  const params = [...devs, 'globals'];
  const devstr = '{' + params.join(',') + '}';

  str = parsing.transformScriptStr(str);
  return 'module.exports = function (' + devstr + ') {\n ' + str + '\n return script;\n}';
}

function isScriptFileUpdated(sceneId, doc) {
  if (!doc || !doc.reqts) return true;
  return fut.getModifyTimeMs(appconfig.getScriptFilename(sceneId)) - doc.reqts > 0;
}

async function createNewScriptFromTemplate(sceneId) {
  // Создать файл в scen и в req
  const scriptStr = getScriptTemplate();
  return createNewScript(sceneId, scriptStr);
}

async function createNewScript(sceneId, scriptStr) {
  await fut.writeFileP(appconfig.getScriptFilename(sceneId), scriptStr);

  const {reqScript} = processScriptStr(scriptStr); 
  const reqFilename = appconfig.getReqScriptFilename(sceneId);
  hut.unrequire(reqFilename);
  await fut.writeFileP(reqFilename, reqScript);
}


async function copyScript(oldId, newId) {
  const scriptStr = await fut.readFileP(appconfig.getScriptFilename(oldId));
  return createNewScript(newId, scriptStr);
}
 
function removeScriptFile(sceneId) {
  fut.delFileSync(appconfig.getScriptFilename(sceneId));
}

// Скрипт в папке script пропал - просто сбросить все поля в записи. req удалить. Состояние=2 - заблокировано
function updateWhenMissingScriptFile(sceneId) {
  const filename = appconfig.getReqScriptFilename(sceneId);
  fut.delFileSync(filename);
  const unsetObj = { multi: 1, devs: 1, starttriggers: 1, realdevs: 1, def: 1 };
  return {
    doc: { _id: sceneId, $set: { unget: 1, status: 2, err: 1, errstr: 'Script not found!' }, $unset: unsetObj }
  };
}

function getScriptTemplate() {
  return `
/** 
* @desc  
* @version 5
*/


const script = {
    start() {
        
    } 
};
`;
}

async function customValidate({ prop, doc, _id }, dm) {
  const val = doc[prop];
  if (prop == 'blk' && !val) {
    const rec = await dm.findRecordById('scene', _id);
    console.log('customValidate rec=' + util.inspect(rec));
    // return rec && rec.err ? 'Script with error!' : '';
    if (rec && rec.err) throw { message: appconfig.getMessage('ScriptWithErrorAlwaysBlocked') };
  }
}

/*
async function getSceneCallNewId(sceneId) {
  const regexp = new RegExp('^' + sceneId + '_\\d{3}$');
  const res = await dm.dbstore.get('scenecall', { _id: regexp }, { fields: { _id: 1 } });
  if (res && res.length) {
    const last = res[res.length - 1];
    const numid = Number(last.substr(sceneId.length)) + 1;
    return sceneId + '_' + String(numid).padStart(3, '0');
  }
  return sceneId + '_001';
}
*/

function createSceneStruct(doc) {
  const { _id, multi, devs, realdevs, starttriggers, def, extprops } = doc;
  const id = _id;
  const sceneId = _id;
  const blk = doc.blk || doc.err ? 1 : 0;
  const error = doc.err ? doc.errstr : '';
  const filename = appconfig.getReqScriptFilename(sceneId);

  const res = { _id, id, sceneId, blk, multi, error, filename, devs, realdevs, starttriggers, def, extprops };
  res.active = 0; // 0 - не запущен, 1 - запущен
  res.laststart = 0;
  res.laststop = 0;
  res.qstarts = 0;
  return res;
}


function isMulti(id) {
  return id && id.indexOf('#') > 0;
}

function getSceneId(id) {
  return id && id.indexOf('#') > 0 ? id.split('#')[0] : id;
}

function  getOneInstanceId(sceneId, callId) {
  return callId ? sceneId + '#' + callId : sceneId;
}

module.exports = {
  sync,
  verifyScene,
  updateScene,
  processScriptFile,
  processScriptStr,
  createNewScriptFromTemplate,
  createNewSceneFromFile,
  copyScript,

  removeScriptFile,
  updateWhenMissingScriptFile,
  isScriptFileUpdated,
  formReqScript,
  customValidate,
  createSceneStruct,
  getSceneId,
  isMulti,
  getOneInstanceId
};
