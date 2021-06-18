/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const path = require('path');
const shortid = require('shortid');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
const plugininstall = require('./plugininstall');

function getExcludedProps() {
  return ['_id', 'name', 'title', 'order', 'parent', 'active', 'suspend'];
}

async function getUnitDocs(holder) {
  return (await holder.dm.dbstore.get('units')).filter(doc => isUnitDoc(doc));
}

function isUnitDoc(doc) {
  return doc && !doc.folder && doc.plugin;
}

function getDefaultPropsFromForm(filename) {
  try {
    const data = fut.readJsonFileSync(filename);
    appconfig.translateSys(data); // Чтобы выполнились подстановки типа ${project}
    if (!data.grid || !Array.isArray(data.grid)) throw { message: 'Invalid form. Exected "grid" aray!' };

    const res = {};
    const pArray = data.grid.map(gridItem => gridItem.id);
    pArray.forEach(p => {
      if (data[p] && Array.isArray(data[p])) {
        data[p].forEach(item => {
          if (item.prop && item.default != undefined) {
            res[item.prop] = item.default;
          }
        });
      }
    });
    return res;
  } catch (e) {
    console.log('ERROR: getDefaultPropsFromForm ' + filename + ': ' + hut.getShortErrStr(e));
    return {};
  }
}

async function install(packFolder, info, emitWatch) {
  if (!info) return;

  const pluginid = info.id;
  const folder = info.dbagent ? appconfig.getTheDbagentPath(pluginid) : appconfig.getThePluginPath(pluginid);

  let mes = info.dbagent ? info.description : 'Plugin ' + pluginid + '. ' + (info.description || '');
  mes += ' version ' + info.version;
  emitWatch(mes);

  try {
    fut.checkAndMakeFolder(folder);

    emitWatch('Copy to  ' + folder);
    await wu.cpP({ src: packFolder, dest: folder });
  } catch (e) {
    // Если установить не удалось - больше ничего не делаем
    console.log('ERROR: install ' + pluginid + util.inspect(e));
    throw e;
  }

  mes = await plugininstall.installShIfExists(pluginid);
  if (mes) emitWatch(mes);
  try {
    mes = await wu.installNodeModulesP(folder);
    if (mes) emitWatch('Npm install: ' + mes);
  } catch (e) {
    console.log('ERROR: Npm install error: ' + util.inspect(e));
    emitWatch('Npm install error: ' + hut.getShortErrStr(e));
  }
}

async function prepareUnitDocAfterInstall({ id, version }, holder) {
  const manifest = await holder.dm.getCachedData({ method: 'getmeta', type: 'manifest', id });
  const _id = getUnitDocId(id, manifest.single);
  console.log('INFO: install ' + _id);

  const unitDoc = await holder.dm.findRecordById('units', _id);

  if (unitDoc) {
    // Уже есть в таблице - обновить системные индикаторы
    refreshIndicatorsVersion();
    return;
  }

  const doc = { _id, parent: 'unitgroup', order: 100 };
  if (!manifest.single) {
    doc.name = id.toUpperCase();
    doc.folder = 1;
  } else {
    createNewUnitDoc(doc, id);
  }
  return doc;

  function refreshIndicatorsVersion() {
    // Уже есть в таблице - обновить системные индикаторы
    const devs = Object.keys(holder.unitSet)
      .filter(unit => unit == id || holder.unitSet[unit].plugin == id)
      .map(unit => holder.unitSet[unit].dn);

    if (devs.length) {
      const res = {};
      devs.forEach(dn => {
        res[dn] = { version };
      });
      holder.emit('received:device:data', res);
    }
  }
}

function getUnitDocId(pluginid, single) {
  return single ? pluginid : 'plugin_' + pluginid;
}

function createNewUnitDoc(doc, pluginid) {
  // Получить свойства-параметры и дефолтные значения для этого плагина из формы formPluginCommon
  const defObj = getDefaultPropsFromForm(appconfig.getV5FormPath(pluginid, 'formPluginCommon'));
  return { ...doc, plugin: pluginid, active: 1, suspend: 1, ...defObj };
}

function invalidateCache(pluginid, dm) {
  dm.invalidateCache({ method: 'getmeta', type: 'plugininfo', id: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'manifest', id: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'formPluginCommon', nodeid: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'formPluginChannelsTable', nodeid: pluginid });
  dm.invalidateCache({ method: 'getmeta', type: 'form', id: 'channelview', nodeid: pluginid });
}

function createSystempluginUnit({ name }, info) {
  const unit = {
    id: name,
    sys: 1,
    doc: { _id: name, restarttime: 5 },
    ps: '',

    getModulepath() {
      return path.join(appconfig.get('pluginspath'), name, 'index.js'); // Путь к модулю для запуска
    },

    getProp(prop) {
      return this.doc[prop] || '';
    },

    getArgs() {
      // Формировать аргументы командной строки - пока port и путь к системе
      const options = {
        port: appconfig.get('port'),
        syspath: appconfig.get('syspath'),
        hwid: appconfig.get('hwid'),
        logfile: appconfig.get('logpath') + '/ih_' + name + '.log'
      };

      return [JSON.stringify(options)];
    },

    setDoc(newDoc) {
      this.doc = hut.clone(newDoc);
    },

    setInfo(infobj) {
      this.info = hut.clone(infobj);
    },

    send(sendObj) {
      if (this.ps) this.ps.send(sendObj);
    },
    sendSigterm() {
      if (this.ps) {
        this.ps.kill('SIGTERM');
        this.ps = 0;
        this.sigterm = 1;
      }
    }
  };

  if (info) unit.setInfo(info);

  return unit;
}

async function calcNewUnitId(plugin, dm) {
  const unitDocs = await dm.dbstore.get('units');
  return hut.calcNewId(unitDocs, '_id', plugin);
}

async function copyUnitDoc(oldId, doc, target, dm) {
  if (!target || !target.startsWith('plugin_')) throw { message: 'Недопустимая операция!' };
  const target_plugin = target.split('_').pop();
  if (target_plugin != doc.plugin) throw { message: 'Копирование возможно только в рамках одного плагина!' };

  doc._id = await calcNewUnitId(doc.plugin, dm);
  doc.id = doc._id;
  await copyChannels(oldId, doc._id, dm);
  return doc;
}

async function copyChannels(fromUnit, toUnit, dm) {
  try {
    // Считать все каналы этого плагина
    const docs = await dm.get('devhard', { unit: fromUnit });
    if (!docs.length) return;

    // Обработать папки
    // Для папок - генерировать новый _id, его нужно будет использовать как parent каналов
    const folders = {};
    docs
      .filter(doc => doc.folder)
      .forEach(doc => {
        const _id = shortid.generate();
        folders[doc._id] = _id;
        doc._id = _id;
        doc.unit = toUnit;
      });

    // Для каналов - Нужно заменить unit, очистить did, prop
    // Каналы могут быть вне папки!!
    // Для вложенных папок - только заменить parent
    docs
      .forEach(doc => {
        doc.parent = folders[doc.parent] || '';
       
        if (!doc.folder) {
          doc._id = shortid.generate();
          doc.unit = toUnit;
          doc.did = '';
          doc.prop = '';
        }
      });

    await dm.insertDocs('devhard', docs);
  } catch (e) {
    console.log('ERROR: pluginutil.copyChannels ' + fromUnit + ' => ' + toUnit + ': ' + util.inspect(e));
    throw { message: 'Ошибка при копировании каналов!' };
  }
}

module.exports = {
  getExcludedProps,
  getUnitDocs,
  isUnitDoc,
  getDefaultPropsFromForm,
  install,
  createNewUnitDoc,
  prepareUnitDocAfterInstall,
  invalidateCache,
  createSystempluginUnit,
  calcNewUnitId,
  copyUnitDoc
};
