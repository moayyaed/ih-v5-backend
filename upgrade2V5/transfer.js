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
const fut = require('../lib/utils/fileutil');

const tut = require('./transfer_utils');
const transformObject = require('./transform_object');
const createDevhard = require('./transfer_devhard');
const devMan = require('./device_man');

/**
 *
 * @param {String} project_c - полный путь к папке проекта Cherry
 * @param {String} project_d - полный путь к папке нового проекта
 * @param {Function} emitMes - функция для вывода сообщений о ходе процесса
 */
module.exports = async function(project_c, project_d, emitMes) {
  try {
    // images - Сами картинки уже скопированы, здесь переносим только таблицы : imagegroups + images
    create(formAllStr('imagegroups', 'jbase') + formImages(), 'images', 'jbase');

    // lists
    add(formAllStr('places', 'jbase'), 'lists', 'jbase');
    add(formAllStr('rooms', 'jbase'), 'lists', 'jbase');

    // Определить новые типы для устройств, сформировать объекты, содержащие устройства и дополнительные типы
    devMan.load(project_c);
    create(tut.createTypes(), 'types', 'jbase');
    create(devMan.formAllDevicesStr(), 'devices', 'jbase');

    create(formPluginFolders() + formAllStr('units', 'jbase'), 'units', 'jbase');
    create(createDevhard(devMan.getDevicesMap(), project_c), 'devhard', 'jbase');
    create(formAllStr('pluginextra', 'jbase'), 'pluginextra', 'jbase');

    // Копировать готовые шаблоны для типов в папку jbase/template. Список записать в таблицу
    const templates = createTemplates();
    create(tut.createVistemplateStr(templates), 'vistemplates', 'jbase');

    // Перенос списка мнемосхем. Генерировать файлы для каждой мнемосхемы в папку jbase/container
    add(formAllStr('mnemoschemes', 'jbase'), 'visconts', 'jbase');
    createFiles('mnemoschemes', 'mnemoscheme', 'container');

    // Перенос списка виджетов. Генерировать файлы для каждого виджета в папку jbase/container - это тоже просто конт
    add(formAllStr('widgets', 'jbase'), 'visconts', 'jbase');
    createFiles('widgets', 'widget', 'container');

    create(formAllStr('layouts', 'jbase'), 'layouts', 'jbase');

    create(formCharts(), 'reports', 'jbase');
    create(formReports(), 'reports', 'jbase');
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    emitMes('ERROR: ' + hut.getShortErrStr(e));
  }

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
      console.log('ERROR: Transfer ' + target + ': ' + util.inspect(e));
      emitMes('ERROR: Transfer ' + target + ': ' + hut.getShortErrStr(e));
    }
  }

  function createTemplates() {
    const src = path.join(__dirname, 'template');
    const dest = path.join(project_d, 'jbase', 'template');
    fut.checkAndMakeFolder(dest);
    const names = [];
    fs.readdirSync(src).forEach(name => {
      fs.copyFileSync(src + '/' + name, dest + '/' + name);
      names.push(hut.getFileNameExtLess(name))
    });
    return names;
  }
  /**
   * Генерация файлов на основе файлов из папки srcFolder (экраны, мнемосхемы)
   * Считать файлы - по списку source
   *   все в папке jbase
   *
   * @param {String} source - имя списка с исходными объектами (список мнемосхем)
   * @param {String} srcFolder - папка с исходными файлами - мнемосхемы - каждая в отд файле
   * @param {String} targetFolder
   */
  function createFiles(source, srcFolder, targetFolder) {
    fut.checkAndMakeFolder(path.join(project_d, 'jbase', targetFolder));

    const list = tut.getSourceData(source, 'jbase', project_c);
    list.forEach(item => {
      try {
        // читать исходный файл  item.id => имя файла
        const srcfile = path.join(project_c, 'jbase', srcFolder, item.id + '.json');

        // преобразовать в новый формат
        const data = transformObject(fut.readJsonFileSync(srcfile), srcFolder, targetFolder, devMan, emitMes);

        // записать файл в папку targetFolder c новым именем
        const newFile = tut.formNewObjectId(source, item.id) + '.json';
        const file = path.join(project_d, 'jbase', targetFolder, newFile);
        fut.writeJsonFileSync(file, data);
        emitMes('Create ' + newFile);
      } catch (e) {
        console.log('ERROR: Transfer file ' + srcFolder + '/' + item.id + util.inspect(e));
        emitMes('ERROR: Transfer ' + srcFolder + '/' + item.id + hut.getShortErrStr(e));
      }
    });
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
      console.log('ERROR: Transfer ' + target + ': ' + util.inspect(e));
      emitMes('ERROR: Transfer ' + target + ': ' + hut.getShortErrStr(e));
    }
  }

  function formAllStr(source, folder) {
    let str = '';
    const data = tut.getSourceData(source, folder, project_c);
    let order = 0;
    data.forEach(item => {
      order += 1000;
      item.order = order;
      str += tut.formRecord(source, item);
    });
    return str;
  }

  // IMAGES
  function formImages() {
    const extObj = tut.getSourceAsObj('imagegroups', 'jbase', project_c);
    const imageData = tut.getSourceData('imagelist', 'jbase', project_c);

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
    const data = tut.getSourceData('units', 'jbase', project_c);
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
      tut.getSourceData('chartlist', 'jbase', project_c),
      tut.getSourceData('charts', 'jbase', project_c),
      'chartid',
      'chartgroup',
      { pref: 'c', len: 3 }
    );
  }

  // REPORTS
  function formReports() {
    return tut.createFromMainAndSlave(
      tut.getSourceData('reportlist', 'jbase', project_c),
      tut.getSourceData('reportcolumns', 'jbase', project_c),
      'repid',
      'reportgroup',
      { pref: 'r', len: 3 }
    );
  }
};
