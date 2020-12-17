/**
 * Функция переноса файлов проекта версии V4 (Cherry) -> V5
 *  - V4 данные проекта хранились в файлах .json
 *  - V5 - используется движок nedb, файлы .db
 *         Файл .db содержит JSON для одной записи + '\n'
 *
 *    При переносе движок nedb не используется. Формируются строки для каждой записи + '\n'
 *    Полученная строка пишется в файл .db
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../lib/utils/hut');
const tut = require('./transfer_utils');

const sysfiles = ['classes', 'types'];

/**
 *
 * @param {String} project_c - полный путь к папке проекта Cherry
 * @param {String} project_d - полный путь к папке нового проекта
 * @param {Function} emitMes - функция для вывода сообщений о ходе процесса
 */
module.exports = async function(project_c, project_d, emitMes) {
  add(formAllStr('places', 'jbase'), 'lists', 'jbase');
  add(formAllStr('rooms', 'jbase'), 'lists', 'jbase');

  // Определить новые типы для устройств, сформировать объекты, содержащие устройства и дополнительные типы

  // Сами картинки уже скопированы, здесь переносим только таблицы : imagegroups + images
  create(formAllStr('imagegroups', 'jbase') + formImages(), 'images', 'jbase');

  create(tut.createTypes(), 'types', 'jbase');
  // create(formDevices(), 'devices', 'jbase');

  create(formPluginFolders() + formAllStr('units', 'jbase'), 'units', 'jbase');
  // create(tut.createDevhard(getSourceData('devhard', 'jbase')), 'devhard', 'jbase');

  create(tut.createVistemplates(), 'vistemplates', 'jbase');
  create(formAllStr('layouts', 'jbase'), 'layouts', 'jbase');
  create(formAllStr('mnemoschemes', 'jbase'), 'visconts', 'jbase');

  create(formCharts(), 'reports', 'jbase');
  create(formReports(), 'reports', 'jbase');

  /** add
   * Добавляет записи в таблицу V5
   *
   * @param {String} str - строка сформированная для db
   * @param {String} target - имя таблицы в V5 (db)
   * @param {String} folder - имя папки
   */
  function add(str, target, folder) {
    try {
      const dfilename = path.join(project_d, folder, target + '.db');
      fs.appendFileSync(dfilename, str);
    } catch (e) {
      console.log('ERROR: Transfer ' + target + ': ' + util.inspect(e))
      emitMes('ERROR: Transfer ' + target + ': ' + hut.getShortErrStr(e));
    }
  }

  /**
   * Создать новый файл данных V5
   *
   * @param {String} str - строка сформированная для db
   * @param {String} target - имя таблицы в V5 (db)
   * @param {String} folder - имя папки
   *
   */
  function create(str, target, folder) {
    try {
      // Записать в новый файл
      const dfilename = path.join(project_d, folder, target + '.db');
      fs.writeFileSync(dfilename, str);
      emitMes('Transfer ' + target);
    } catch (e) {
      console.log('ERROR: Transfer ' + target + ': ' + util.inspect(e))
      emitMes('ERROR: Transfer ' + target + ': ' + hut.getShortErrStr(e));
    }
  }

  function formAllStr(source, folder) {
    let str = '';
    const data = getSourceData(source, folder);
    let order = 0;
    data.forEach(item => {
      order += 1000;
      item.order = order;
      str += tut.formRecord(source, item);
    });
    return str;
  }

  // DEVICES
  function formDevices() {
    const sObj = getSourceAsObj('subsystems', 'jbase');
    return tut.createDevices(getSourceData('devref', 'jbase'), project_d, sObj);
  }

  // IMAGES
  function formImages() {
    const extObj = getSourceAsObj('imagegroups', 'jbase');
    const imageData = getSourceData('imagelist', 'jbase');

    let str = '';
    let order = 100;
    imageData.forEach(item => {
      const parent = item.group && extObj[item.group] ? 'img' + item.group : 'imagegroup';
      const obj = { _id: item.img, parent, order, name: item.img };
      str += JSON.stringify(obj) + '\n';
      order += 100;
    });
    return str;
  }

  // PLUGINS
  function formPluginFolders() {
    // Все будет храниться в units, корневая тоже
    const parent = 'unitgroup';
    const obj = { _id: parent, folder: 1, parent: 0, name: 'Plugins' };
    let str = JSON.stringify(obj) + '\n';

    // Выбрать плагины НЕ single - только для них делаю папки
    const data = getSourceData('units', 'jbase');
    const plSet = new Set();
    data.forEach(item => {
      if (item.id != item.plugin) plSet.add(item.plugin);
    });

    let order = 100;
    for (const plugin of plSet) {
      const pobj = { _id: 'plugin_' + plugin, folder: 1, parent, order, name: plugin.toUpperCase() };
      str += JSON.stringify(pobj) + '\n';
      order += 100;
    }
    return str;
  }

  // CHARTS
  function formCharts() {
    return tut.createFromMainAndSlave(
      getSourceData('chartlist', 'jbase', project_c),
      getSourceData('charts', 'jbase', project_c),
      'chartid',
      'chartgroup',
      { pref: 'c', len: 3 }
    );
  }

  // REPORTS
  function formReports() {
    return tut.createFromMainAndSlave(
      getSourceData('reportlist', 'jbase', project_c),
      getSourceData('reportcolumns', 'jbase', project_c),
      'repid',
      'reportgroup',
      { pref: 'r', len: 3 }
    );
  }

  /**
   * Cчитать файл из исходного проекта
   * @param {String} source
   * @param {String} folder
   * @return {Array of Object}
   */
  function getSourceData(source, folder) {
    try {
      if (sysfiles.includes(source)) return tut.getSysDataFile(source);

      const cfilename = path.join(project_c, folder, source + '.json');
      return JSON.parse(fs.readFileSync(cfilename, 'utf8'));
    } catch (e) {
      console.log('ERROR: Get Source Data ' + source + ': ' + util.inspect(e));
      emitMes('ERROR: Get Source Data ' + source + ': ' + hut.getShortErrStr(e));
      return [];
    }
  }

  function getSourceAsObj(source, folder) {
    const extdata = getSourceData(source, folder);
    const sObj = {};
    extdata.forEach(item => {
      if (item.id && item.name) sObj[item.id] = item.name;
    });
    return sObj;
  }
};
