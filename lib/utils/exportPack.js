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
      if (img.indexOf('/') < 0) {
        ihpack.images.push(img);
      }
    }

    // Внутри elements.button_1.img: {value:'xx.svg'}
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (data.elements[elName].type && data.elements[elName].img) {
          // Если ссылка - не копировать. Это д б имя файла
          const img = data.elements[elName].img.value;
          if (img.indexOf('/') < 0) {
            ihpack.images.push(img);
          }
        }
      });
    }
  }

  // param = 'template'
  async function exportOne(item, param, table) {
    if (item.id) {
      const doc = await dm.findRecordById(table, item.id);

      // Найти шаблон,
      const data = await loadsys.loadProjectJson(param, item.id);
      if (data) {
        // в нем найти все image, имена картинок записать в ihpack
        gatherImages(data);

        // Сформировать имя файла и name элемента пакета
        const exportId = formExportId(item, doc, prefix);
        const filename = exportId + '.json';
        const name = doc && doc.name ? doc.name : exportId;

        // Исходник сохранить в папку tempFolder
        await fut.writeFileP(path.join(tempFolder, filename), data);
        return { id: exportId, filename, name };
      }
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
