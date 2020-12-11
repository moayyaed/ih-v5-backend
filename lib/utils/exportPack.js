/**
 * exportPack.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');
const dataformer = require('../api/dataformer');

const hut = require('./hut');
const fut = require('./fileutil');
const loadsys = require('./loadsys');

/**
 * exportPack.js
 *  Функция готовит пакет для экспорта
 *  Возвращает путь к временной папке с пакетом
 *  Если не удалось создать пакет - возвращается пустая строка
 */
async function exec(query) {
  if (!query || !query.nodeid || !query.param) return '';

  // TODO - здесь пока или один диалог или template или image
  const objToExport = getObjToExport(query);

  // query.param == 'dialog' ? { dialogs: [{ id: query.nodeid }] } : { templates: [{ id: query.nodeid }] };

  const prefix = appconfig.get('project_prefix');

  const ihpack = { images: [], prefix }; // prefix - Не нужен??

  const packName = await formPackName(query);

  const tempFolder = appconfig.get('worktemppath') + '/' + packName;

  try {
    // Создать папку для пакета. Если существует - удалить. Должна быть пустая папка
    fut.createEmptyFolder(tempFolder);
  } catch (e) {
    console.log('ERROR: exportPack createEmptyFolder: ' + util.inspect(e));
    return { error: e.message };
  }

  try {
    ihpack.images = [];
    if (objToExport.images) {
      for (const item of objToExport.images) {
        // TODO - если это папка - нужно отправить вложенные картинки + папки?
        ihpack.images.push(item.id);
      }
    }

    if (objToExport.templates) {
      ihpack.templates = [];
      for (const item of objToExport.templates) {
        const one = await exportOne(item, 'template', 'template');
        if (one) ihpack.templates.push(one);
      }
    }

    if (objToExport.dialogs) {
      ihpack.dialogs = [];
      for (const item of objToExport.dialogs) {
        const one = await exportOne(item, 'dialog', 'dialog');
        if (one) ihpack.dialogs.push(one);
      }
    }

    if (objToExport.containers) {
      ihpack.containers = [];
      for (const item of objToExport.containers) {
        const one = await exportOneContainer(item, 'container', 'container');
        if (one) ihpack.containers.push(one);
      }
    }

    // Копировать images
    await copyImages(ihpack.images, tempFolder);

    await fut.writeFileP(path.join(tempFolder, 'pack.json'), ihpack);
    return { folder: tempFolder, name: packName };
  } catch (e) {
    console.log('ERROR: exportPack: ' + util.inspect(e));
    return { error: e.message };
  }

  function gatherImages(data) {
    // Внутри settings.backgroundImage: {value:'xx.jpg'}
    if (data.settings && data.settings.backgroundImage) {
      const img = data.settings.backgroundImage.value;
      if (trueImage(img)) ihpack.images.push(img);
    }

    // Внутри elements.button_1.img: {value:'xx.svg'}
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (data.elements[elName].type && data.elements[elName].img) {
          const img = data.elements[elName].img.value;
          if (trueImage(img)) ihpack.images.push(img);
        }
      });
    }
  }

  // Если ссылка - не копировать. Это д б имя файла
  function trueImage(name) {
    const imgExclude = ['unset', 'noimage.svg'];
    return name && name.indexOf('/') < 0 && !imgExclude.includes(name);
  }

  // param = 'template'
  async function exportOne(item, param, table) {
    if (!item.id) return;

    // Найти исходный файл
    const data = await loadsys.loadProjectJson(param, item.id);
    if (!data) return;
    
    // в нем найти все image, имена картинок записать в ihpack
    gatherImages(data);

    // Сформировать имя файла и name элемента пакета
    const doc = await dm.findRecordById(table, item.id);
    const exportId = formExportId(item, doc, prefix);
    const filename = exportId + '.json';
    const name = doc && doc.name ? doc.name : exportId;

    // Исходник сохранить в папку tempFolder
    await fut.writeFileP(path.join(tempFolder, filename), data);
    return { id: exportId, filename, name };
  }

  async function exportOneContainer(item, param, table) {
    if (!item.id) return;

    // Найти исходный файл
    const data = await loadsys.loadProjectJson(param, item.id);
    if (!data) return;

    // в нем найти все templates
    const templateSet = gatherTemplates(data); //
    console.log('templateSet = ' + util.inspect(templateSet));
    if (!Object.keys(templateSet).length) return exportOne(item, param, table); // их там нет

    // Каждый template сохраняем, он будет переименован как обычно
    if (!ihpack.templates) ihpack.templates = [];
    for (const elName of Object.keys(templateSet)) {
      // templateSet[tempate_1] = 'vt097'
      const one = await exportOne({ id: templateSet[elName] }, 'template', 'template');
      // one =  { id: exportId, filename, name };
      if (one) {
        ihpack.templates.push(one);
        templateSet[elName] = one.id;
      }
    }

    // Переименовать в data
    replaceTemplatesId(data, templateSet);

    // Сформировать имя файла и name элемента пакета
    const res = await formIhpackItem(table, item);

    // Исходник сохранить в папку tempFolder
    await fut.writeFileP(path.join(tempFolder, res.filename), data);
    return res;
  }

  async function formIhpackItem(table, item) {
    // Сформировать имя файла и name элемента пакета
    const doc = await dm.findRecordById(table, item.id);
    const res = {};
    const exportId = formExportId(item, doc, prefix);
    res.id = exportId;
    res.filename = exportId + '.json';
    res.name = doc && doc.name ? doc.name : exportId;
    return res; // {id, filename, name}
  }

  function gatherTemplates(data) {
    // data.elements.tempate_1:{type:'template', templateId:'vt097'}
    const templateSet = {};
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (data.elements[elName].type == 'template' && data.elements[elName].templateId) {
          templateSet[elName] = data.elements[elName].templateId; // templateSet[tempate_1] = 'vt097'
        }
      });
    }
    return templateSet;
  }

  function replaceTemplatesId(data, templateSet) {
    // data.elements.tempate_1:{type:'template', templateId:'vt097'}
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (templateSet[elName]) {
          data.elements[elName].templateId = templateSet[elName]; // templateSet[tempate_1] = 'user@vt097'
        }
      });
    }
  }
}

async function copyImages(imagesArr, toFolder) {
  const imagepath = appconfig.getImagePath();
  for (const img of imagesArr) {
    try {
      await fut.copyFileP(path.join(imagepath, img), path.join(toFolder, img));
    } catch (e) {
      console.log('ERROR: Export image ' + util.inspect(e) + '. Skipped');
    }
  }
}

async function formPackName(query, prefix) {
  if (query.param == 'image') return query.nodeid.indexOf('.') ? query.nodeid : query.nodeid + '.zip'; // Это имя файла или id папки!
  if (query.param == 'project') return query.nodeid + '.ihpack';

  prefix = prefix || appconfig.get('project_prefix');
  // Получить exid для query
  const doc = await dm.findRecordById(query.param, query.nodeid);
  const name = prefix + '@' + (doc ? getExId(doc) : query.nodeid);
  return name + '.ihpack';
}

function formExportId(item, doc, prefix) {
  if (!doc) return item.id;
  if (hut.prefAt(doc._id)) return doc._id; // id уже включает @
  return (doc.__expref || prefix) + '@' + getExId(doc);
}

function getExId(doc) {
  return doc.__exid || doc._id;
}

function getObjToExport(query) {
  switch (query.param) {
    case 'image':
      return { images: [{ id: query.nodeid }] };
    case 'dialog':
      return { dialogs: [{ id: query.nodeid }] };
    case 'template':
      return { templates: [{ id: query.nodeid }] };

    case 'container':
      return { containers: [{ id: query.nodeid }] };
    default:
      return {};
  }
}

async function prepareToExport(query, holder) {
  if (!query.nodeid) throw { error: 'ERRGET', message: 'Missing nodeid!' };
  if (!query.param) throw { error: 'ERRGET', message: 'Missing param!' };

  if (query.param == 'image') return prepareToExportImage(query, holder);

  const title = await getTitle();
  const url = getUrl(query);
  const filename = await formPackName(query);

  const data = { title, url, filename };
  return { data };

  async function getTitle() {
    let res = '';
    switch (query.param) {
      case 'template':
        res = 'template ' + query.nodeid;
        break;
      case 'dialog':
        res = 'dialog ' + query.nodeid;
        break;
      case 'container':
        res = 'container ' + query.nodeid;
        break;
      case 'project':
        res = 'project ' + query.nodeid;
        break;
      default:
        throw { error: 'ERRGET', message: 'Unexpected param for export!' };
    }
    if (!res) throw { error: 'ERRGET', message: 'Missing param!' };

    return 'Export: ' + res;
  }
}

/**
 * Подготовка к выгрузке файла изображения или несколько файлов внутри папки
 *
 * @param {Object} query
 *   nodeid: имя файла изображения или id папки
 * @param {Object} holder
 */
async function prepareToExportImage(query) {
  const url = getUrl(query);
  const nodeid = query.nodeid;

  let data;
  // Если это id файла с изображением
  if (hut.isImgFile(nodeid)) {
    data = { title: nodeid, filename: nodeid, url };
  } else {
    const doc = await dm.findRecordById('imagegroup', nodeid);
    if (!doc) throw { message: 'Not found imagegroup ' + nodeid };

    // Это папка - выбрать все файлы, посчитать их
    const imagegrid = await dataformer.getImagegrid(nodeid);
    const imgArr = imagegrid ? imagegrid.data : '';

    if (!imgArr || !imgArr.length) throw { message: doc.name + '. ' + appconfig.getMessage('EmptyFolder') };

    const title = `${imgArr.length} ${appconfig.getMessage('filesFromFolder')} ${doc.name}`;
    data = { title, url, filename: query.nodeid + '.zip' };
  }
  return { data };
}

function getUrl(query) {
  return '/api/export?param=' + query.param + '&nodeid=' + query.nodeid;
}

async function exportImage(query) {
  if (!query.nodeid) return { error: 'Expected nodeid for export!' };

  const nodeid = query.nodeid;

  // Если это id файла с изображением - export 1 file
  if (hut.isImgFile(nodeid)) {
    let name = path.join(appconfig.getImagePath(), query.nodeid);
    if (!fs.existsSync(name)) return { error: 'File for export not found: ' + name };

    return { folder: '', name };
  }

  try {
    // Это папка - выбрать файлы из папки, переписать их во вспомогательную папку
    const imagegrid = await dataformer.getImagegrid(nodeid);
    const imgArr = imagegrid ? imagegrid.data : '';
    if (!imgArr || !imgArr.length) throw { message: 'No images in folder: ' + nodeid };

    const tempFolder = appconfig.get('worktemppath') + '/' + nodeid;

    // Создать папку. Если существует - удалить. Должна быть пустая папка
    fut.createEmptyFolder(tempFolder);

    // Копировать файлы
    await copyImages(imgArr, tempFolder);

    return { folder: tempFolder, name: nodeid + '.zip' };
  } catch (e) {
    console.log('ERROR: exportImage: ' + util.inspect(e));
    return { error: e.message };
  }
}

// Если нужно выгрузить проект - просто передать путь к папке проекта
async function exportProject(query) {
  if (!query.nodeid) return { error: 'Expected nodeid for export!' };
  const project = query.nodeid;
  let folder = appconfig.getTheProjectPath(project);

  if (!appconfig.isProjectPath(folder)) return { error: 'Missing or invalid or empty project: ' + folder };

  return { folder, name: project };
}
module.exports = {
  exec,
  prepareToExport,
  exportImage,
  exportProject
};
