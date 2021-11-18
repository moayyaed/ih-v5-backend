/**
 * scriptdata.js
 *
 * Данные форм, хранящиеся в файла, type = code' | 'script' | 'markdown'
 */

const util = require('util');

const fs = require('fs');

const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const fileutil = require('../utils/fileutil');
const loadsys = require('../utils/loadsys');
const typestore = require('../device/typestore');
const handlerutil = require('../device/handlerutil');
const pluginutil = require('../plugin/pluginutil');
const sceneutils = require('../scene/sceneutils');


const documentation = require('./documentation');

/**
 *
 * @param {} prop
 * @param {*} table
 * @param {*} query
 */
async function get(prop, table, query) {
  // Вернуть код из файла в виде строки
  const { nodeid, navnodeid, id } = query;
  switch (prop) {
    case 'handler':
      return getHandler(table, nodeid);

    case 'channelscript':
      return getChannelscript(table, nodeid, id);

    case 'docpage':
      // query.nodeid = id из submenu
      // query.navnodeid - id из основного дерева
      return getDocPage(navnodeid, nodeid);
    // return getMarkdown(table, nodeid);
    case 'module':
      return getModule(table, nodeid);
    default:
      return loadsys.loadScene(nodeid);
  }
}

async function save(prop, nodeid, value, dm) {
  switch (prop) {
    case 'handler':
      return saveHandler(nodeid, value, dm);

    case 'channelscript':
      return saveChannelscript(nodeid, value, dm);

    case 'docpage':
      return documentation.saveDocPage(nodeid, value, dm);
    case 'module':
      savePluginModule(nodeid, value, dm);
      invalidatePluginCaches(nodeid, dm);
      break;
    default:
      return saveScript(nodeid, value, dm);
  }
}

async function getDocPage(id, lang) {
  const filename = appconfig.getDocPageFilename(id, lang);
  return fs.existsSync(filename) ? fs.promises.readFile(filename, 'utf8') : '## New Page';
}

async function getHandler(table, preId) {
  if (!preId) return '';
  if (preId.startsWith('api') || preId.startsWith('restapi')) return loadsys.loadRestapihandler(preId);

  if (table && table.startsWith('custom')) return handlerutil.getCustomHandler(table, preId);

  if (preId.indexOf('.') > 0) {
    const [typeId, prop] = preId.split('.');
    return typestore.getHandlerStr(typeId, prop);
  }

  if (preId.startsWith('gl')) return handlerutil.getGlobalVarHandler(preId);
  if (preId.startsWith('vs')) return handlerutil.getVisScript(preId);
  return '';
}

async function getModule(table, preId) {
  let filename;
  if (table == 'units') {
    try {
      filename = appconfig.get('pluginspath') + '/' + hut.replaceAll(preId, '*', '/');
      // return 'table='+table+' nodeid='+nodeid+' preId='+preId+' navnodeid='+navnodeid;
      return loadsys.loadFile(filename);
    } catch (e) {
      return 'Loading ' + filename + ' error: ' + util.inspect(e);
    }
  }
}


async function getChannelscript(table, nodeid, formid) {
  // formId=channelfolder.basicplus
  if (!formid || !nodeid || formid.indexOf('.')<0) throw {message:'formid='+formid+'. Expected formId with plugin instance id!'}
  const unit = formid.split('.')[1];
  if (!unit) throw {message:'formid='+formid+'. Expected formid with plugin instance!'}
  
  const filename = appconfig.getChannelscriptFilepath(unit, nodeid);
  if (!filename) throw {message:'Error getChannelscript: '+filename};
  return fs.existsSync(filename) ? fs.promises.readFile(filename, 'utf8') : getDefaultScript();
}

function getDefaultScript() {
  return `module.exports = function(data) {

  }
  `;
}

// --------------

async function savePluginModule(nodeid, value) {
  let filename = hut.replaceAll(nodeid, '*', '/');
  filename = appconfig.get('pluginspath') + '/' + filename;
  await fileutil.writeFileP(filename, value);
}

async function invalidatePluginCaches(nodeid, dm) {
  const pluginid = nodeid.split('*')[0]; 
  pluginutil.invalidateCache(pluginid, dm);
}

async function saveChannelscript(nodeid, value, dm) {
  // basicplus#-slqgRppG
  if (!nodeid) return;
  const [unit, id] = nodeid.split('#');
  const filename = appconfig.getChannelscriptFilepath(unit, id);
  await fileutil.writeFileP(filename, value);
}


async function saveHandler(nodeid, value, dm) {
  // При сохранении проверить module.exports = function
  // retObj = await processHandlerStrBeforeSaveToFile(nodeid, value);
  if (!nodeid) return;

  if (nodeid.indexOf('.') > 0) {
    // обработчики для типов
    const [typeId, prop] = nodeid.split('.');
    const typeObj = typestore.getTypeObj(typeId);
    if (!typeObj) {
      throw { message: 'Not found type ' + typeId };
    }

    // Если обработчик не пользовательский - не сохраняем
    // Не получилось сделать disabled:"data.p1.fuse<2", работает только disabled:true/false
    if (!prop.startsWith('_On') && !prop.startsWith('_format')) {
      const fuse = typestore.getTypeObjPropField(typeId, prop, 'fuse');
      if (fuse < 2) {
        throw {
          message: 'Для редактирования переключите тип обработчика на "Пользовательский" на вкладке "Свойства".'
        };
      }
    }
    const filename = appconfig.getHandlerFilename(nodeid);
    hut.unrequire(filename);
    await fileutil.writeFileP(filename, value);

    const result = handlerutil.checkHandler(typeObj, prop); // {toUpdate:{}, errstr}
    dm.emit('updated:typehandler', { typeId, prop, filename, errstr: result.errstr }); // Установить в typeObj, traceSet и на worker
    return result.toUpdate; // Для записи в таблицу

    // return handlerutil.checkHandler(typeObj, prop);
  }

  // if (nodeid.startsWith('api') || nodeid.startsWith('restapi')) {
  const filename =
    nodeid.startsWith('api') || nodeid.startsWith('restapi')
      ? appconfig.getRestapihandlerFilename(nodeid)
      : nodeid.startsWith('vs')
      ? appconfig.getVisScriptFilename(nodeid)
      : appconfig.getHandlerFilename(nodeid);
  hut.unrequire(filename);
  await fileutil.writeFileP(filename, value);
}

async function saveScript(nodeid, value, dm) {
  // sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw
  let res;
  let filename;
  let event;
  let table;
  if (nodeid.startsWith('snippet')) {
    table = 'snippet';
    filename = appconfig.getSnippetFilename(nodeid);
    event = 'saved:snippet';
  } else if (nodeid.startsWith('api')) {
    table = 'restapihandler';
    filename = appconfig.getRestapihandlerFilename(nodeid);
    event = 'saved:restapihandler';
  } else {
    table = 'scene';
    filename = appconfig.getScriptFilename(nodeid);
    const rec = await dm.findRecordById('scene', nodeid);
    const multi = rec && rec.multi ? 1 : 0;
    res = await sceneutils.processScriptFile(nodeid, { multi }, value);

    // Проверить устройства сценария??

    event = 'saved:script';
  }

  hut.unrequire(filename);
  await fileutil.writeFileP(filename, value);

  dm.emit(event, nodeid);
  return { table, doc: res };
}

module.exports = {
  get,
  save
};
