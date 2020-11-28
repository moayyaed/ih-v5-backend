/**
 * sceneutils.js
 */

const util = require('util');
// const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');


const ROOT = 'scenegroup';

/** syncScripts
 *  Синхронизация папки со скриптами и таблицы скриптов
 *   - Если в таблице нет - добавить запись
 *   - Если в таблице есть, а файла нет, строка удаляется?? а помечается как отсутствующая (unget)
 *
 * Результат: массив записей для добавления и измененения в таблице snippets
 *
 * @param {Array of objects} sceneDocs - записи в таблице snippets
 * @result {Array} массив записей - [{new:true, _id:,,,,}, {_id,.. $set:{}}]
 *         Элемент м б пустая строка - если не изменился snippet
 */
async function syncScripts(docs) {
  let changeDocs;
  try {
    const fileNames = await fut.readdirP(appconfig.getScriptPath());
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

function getNewSnippet() {
  return `module.exports = (target, callback) => {
    callback(null, 1);
  };
  `;
}

async function createNewSnippet(id) {
  return fut.writeFileP(appconfig.getSnippetFilename(id), getNewSnippet());
}

async function processScriptFile(sceneId) {
  const result = {};
  try {
    const scriptStr = await fut.readFileP(appconfig.getScriptFilename(sceneId));

    const sceneObj = processScriptStr(scriptStr, sceneId); // Обрабатывает скрипт, создает новый req
    if (!sceneObj.reqScript) throw { message: 'Script was not generated!' };

    // await fs.promises.writeFile(appconfig.getReqScriptFilename(sceneId), sceneObj.reqScript, 'utf8');
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
function processScriptStr(scriptStr, sceneId) {

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



function isScriptFileUpdated(sceneId, doc) {
  if (!doc || !doc.reqts) return true;
  // return Math.round(fs.statSync(appconfig.getScriptFilename(sceneId)).mtimeMs) - doc.reqts > 0;
  return fut.getModifyTimeMs(appconfig.getScriptFilename(sceneId)) - doc.reqts > 0;
}

function removeScriptFile(id) {
  fut.delFileSync(appconfig.getSnippetFilename(id));
}


async function verifyUpdateScene(sceneId, doc) {
  // Сначала проверить время, req создавать только если время <
  return isScriptFileUpdated(sceneId, doc) ? updateScene(sceneId, doc) : '';
}

async function updateScene(sceneId, doc) {
  console.log('updateScene START')
  const setObj = await processScriptFile(sceneId);
  if (!setObj.err) {
    setObj.unget = 0;
    setObj.err = 0;
    setObj.errstr = '';
  } else setObj.status = 2; // Если ошибка - блокировать сценарий
  return { ...doc, $set: setObj };
}


module.exports = {
  syncScripts,
  updateScene,
  removeScriptFile,
  createNewSnippet
};
