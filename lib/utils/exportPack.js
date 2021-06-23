/**
 * exportPack.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dataformer = require('../api/dataformer');
const datautil = require('../api/datautil');

const hut = require('./hut');
const fut = require('./fileutil');
const imageutil = require('./imageutil');
const loadsys = require('./loadsys');

/**
 * exportPack.js
 *  Функция готовит пакет для экспорта
 *  Возвращает путь к временной папке с пакетом
 *  Если не удалось создать пакет - возвращается пустая строка
 */
async function exec(query, holder) {
  if (!query || !query.nodeid || !query.param) return '';

  // TODO - здесь пока или один диалог или template или image
  const objToExport = getObjToExport(query);

  const prefix = appconfig.get('project_prefix');

  const ihpack = { images: [], prefix }; // prefix - Не нужен??

  const packName = await formPackName(query, '', holder);

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

    if (objToExport.types) {
      ihpack.types = [];
      for (const item of objToExport.types) {
        const one = await exportOneType(item);
        if (one) ihpack.types.push(one);
      }
    }

    // Копировать images
    if (ihpack.images.length) {
      await copyImages(ihpack.images, tempFolder);
    }

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
    // const imgExclude = ['unset', 'noimage.svg'];
    return name && name.indexOf('/') < 0 && !imageutil.imgExclude.includes(name);
  }

  async function exportOneType(item) {
    if (!item.id) return;

    // Считать тип
    const doc = await holder.dm.findRecordById('type', item.id);
    if (!doc || !doc.props) return;

    const exportId = formExportId(item, doc, prefix);
    const name = doc && doc.name ? doc.name : exportId;

    /*
    "props":{
      "value":{"name":"Значение","vtype":"N","op":"rw","fuse":2},
      "setpoint":{"name":"Уставка","vtype":"N","op":"par"}
    }
    */
    // Собрать имена свойств, у которых обработчики fuse=2 в массив
    const hArr = Object.keys(doc.props).filter(prop => doc.props[prop].fuse == 2);

    // Добавить обработчики _format_value
    Object.keys(doc.props).forEach(prop => {
      if (doc.props[prop].format == 2) hArr.push('_format_' + prop);
    });

    // Добавить обработчики _OnSchedule, _OnChange, _OnInterval
    if (doc.scriptOnChange) hArr.push('_OnChange');
    if (doc.scriptOnInterval) hArr.push('_OnInterval');
    if (doc.scriptOnSchedule) hArr.push('_OnSchedule');

    const handlers = [];
    //  Их нужно будет скопировать с заменой имени
    for (const prop of hArr) {
      const hfile = path.join(appconfig.getHandlerPath(), item.id + '_' + prop + '.js');
      const newfile = exportId + '_' + prop + '.js';
      try {
        if (fs.existsSync(hfile)) {
          await fs.promises.copyFile(hfile, path.join(tempFolder, newfile));
          handlers.push(newfile);
        }
      } catch (e) {
        console.log('ERROR: Export handler ' + hfile + util.inspect(e) + '. Skipped');
      }
    }

    return Object.assign(doc, { id: exportId, handlers, name });
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
    const doc = await holder.dm.findRecordById(table, item.id);
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
    const doc = await holder.dm.findRecordById(table, item.id);
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
      // await fut.copyFileP(path.join(imagepath, img), path.join(toFolder, img));
      await fs.promises.copyFile(path.join(imagepath, img), path.join(toFolder, img));
    } catch (e) {
      console.log('ERROR: Export image ' + util.inspect(e) + '. Skipped');
    }
  }
}

async function formPackName(query, prefix, holder) {
  if (query.param == 'image') return query.nodeid.indexOf('.') ? query.nodeid : query.nodeid + '.zip'; // Это имя файла или id папки!
  if (query.param == 'project') return query.nodeid + '.ihpack';

  prefix = prefix || appconfig.get('project_prefix');
  // Получить exid для query
  const doc = await holder.dm.findRecordById(query.param, query.nodeid);
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
    case 'type':
      return { types: [{ id: query.nodeid }] };
    default:
      return {};
  }
}

/**
 * Подготовка к выгрузке одного файла изображения или несколько файлов внутри папки
 *
 * @param {Object} query
 *   nodeid: имя файла изображения или id папки
 * @param {Object} holder
 */
async function exportImage(query, holder) {
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
    const imagegrid = await dataformer.getImagegrid(nodeid, holder.dm);
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
async function exportProject(query, holder) {
  if (!query.nodeid) return { error: 'Expected nodeid for export!' };
  const project = query.nodeid;
  let folder = appconfig.getTheProjectPath(project);

  if (!appconfig.isProjectPath(folder)) return { error: 'Missing or invalid or empty project: ' + folder };
  const exclude = ['db', 'logdb', 'operative', 'temp'];

  return { folder, name: project, exclude};
}

async function exportLog(query, holder) {
  if (!query.nodeid) return { error: 'Expected nodeid for export!' };
  const filename = datautil.getLogFilename('', query.nodeid);
  return { name: filename};
}

module.exports = {
  exec,
  exportImage,
  exportLog,
  exportProject,
  formPackName
};
