/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
// const wu = require('../utils/wrappers');

const appconfig = require('../appconfig');
// const plugininstall = require('./plugininstall');

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
    // console.log('ERROR: getDefaultPropsFromForm ' + filename + ': ' + hut.getShortErrStr(e));
    // Может и не быть
    return {};
  }
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
        temppath: appconfig.get('temppath'),
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
    docs.forEach(doc => {
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

/** getInstalledPlugins
 * Возвращает массив  данных установленных плагинов (папки в папке plugins)
 * - Исключаются системные плагины
 * - Берутся только плагины с правильным <name>.ih: имя папки = name
 * - Берутся только плагины версии 5.0 и выше
 *
 *  @return {Array Of Objects}: [{id, version, description}] - это свойства из ih
 */
async function getInstalledV5Plugins() {
  const systemplugins = appconfig.getSystemplugins();
  const systemPluginSet = hut.arrayToObject(systemplugins, 'name');

  let result = [];
  try {
    const folder = appconfig.get('pluginspath');
    const pluginNames = fut.readFolderSync(folder, { dir: 1 });

    for (const name of pluginNames) {
      if (!systemPluginSet[name]) {
        const filename = path.join(folder, name, name + '.ih');
        try {
          const info = fut.readJsonFileSync(filename);
          if (info && info.id && info.version && info.version >= '5.0') {
            result.push({ ...info });
          }
        } catch (e) {
          // Если нет файла ih - это не плагин??
        }
      }
    }
  } catch (e) {
    console.log('ERROR: getInstalledPlugins ' + util.inspect(e));
  }
  return result;
}

/** getV5PluginTable
 *
 *  Возвращает массив данных всех плагинов (папки в папке plugins+доступные для скачивания плагины)
 *  Системные плагины не включаются
 *
 *  @return {Array Of Objects}: [{id, description, yurl, version,  newversion, status}]
 */
async function getV5PluginTable(holder) {
  // Считать список всех плагинов - он закачан по кнопке Проверить обновления и помещен в папку base
  const allPlugins = appconfig.getV5Plugins();
  const pluginMap = new Map(allPlugins.map(item => [item.id, item]));

  // Считать список установленных плагинов
  const arr = await getInstalledV5Plugins(holder);

  arr.forEach(item => {
    if (pluginMap.has(item.id)) {
      const pitem = pluginMap.get(item.id);
      item.newversion = hut.getVesionNumbers(pitem.version);
      // item.yurl = !!pitem.url; // Есть ссылка для скачивания
      item.status = item.newversion && item.version < item.newversion ? 2 : 1;
      pluginMap.delete(item.id);
    } else {
      item.status = 1;
    }
  });

  // Оставшиеся плагины - доступны для установк
  for (const [id, item] of pluginMap) {
    // const yurl = !!item.url;
    const status = item.license ? 4 : 3;
    arr.push({
      id,
      version: '',
      license: item.license,
      newversion: item.version,
      status,
      description: item.description
    });
  }
  return arr;
}

function getPropFromV5PluginTable(id, prop) {
  const allPlugins = appconfig.getV5Plugins();
  const plugin = allPlugins.find(el => el.id == id);
  return plugin ? plugin[prop] : '';
}

async function saveToPersistent(unitId, filename, data) {
  const plugin = appconfig.getPluginIdFromUnitId(unitId);
  const folder = appconfig.getPluginPersistentStorePath(plugin);
  if (!folder) throw { message: 'Failed saveToPersistent. No folder!' };
  await fut.writeFileP(folder + '/' + filename, data);
}

async function getFromPersistent(unitId, filename) {
  const plugin = appconfig.getPluginIdFromUnitId(unitId);
  const folder = appconfig.getPluginPersistentStorePath(plugin);
  filename = folder + '/' + filename;
  if (fs.existsSync(filename)) {
    return fut.readFileP(filename);
  }
}

async function getAllFromPersistent(unitId) {
  const plugin = appconfig.getPluginIdFromUnitId(unitId);
  const folder = appconfig.getPluginPersistentStorePath(plugin);
  const res = {};
  const arr = await fs.promises.readdir(folder); // filenames only
  for (const name of arr) {
    try {
      const filename = folder + '/' + name;
      const str = await fs.promises.readFile(filename, 'utf8');
      res[name] = str;
    } catch (e) {
      console.log('ERROR: getAllFromPersistent '+unitId+util.inspect(e))
    }
  }
  return res;
  /*
  filename = folder + '/' + filename;
  if (fs.existsSync(filename)) {
    return fut.readFileP(filename);
  }
  */
}

async function getManifestProp(unit, prop, dm) {
  const manifest = await dm.getManifest(unit);
  return manifest ? manifest[prop] : '';
}

module.exports = {
  getExcludedProps,
  getUnitDocs,
  isUnitDoc,
  getDefaultPropsFromForm,
  createNewUnitDoc,
  invalidateCache,
  createSystempluginUnit,
  calcNewUnitId,
  copyUnitDoc,
  getInstalledV5Plugins,
  getV5PluginTable,
  getPropFromV5PluginTable,
  getFromPersistent,
  getAllFromPersistent,
  saveToPersistent,
  getManifestProp
};
