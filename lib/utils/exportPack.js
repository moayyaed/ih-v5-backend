/**
 * exportPack.js
 */

const util = require('util');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

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

  // TODO - здесь пока или один диалог или template
  const objToExport =
    query.param == 'dialog' ? { dialogs: [{ id: query.nodeid }] } : { templates: [{ id: query.nodeid }] };

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

    /*
    if (objToExport.templates) {
      // Выгрузка шаблонов
      ihpack.templates = [];

      for (const item of objToExport.templates) {
        if (item.id) {
          // Найти документ
          const doc = await dm.dbstore.findOne('vistemplates', { _id: item.id });

          // Найти шаблон, в нем найти все image, копировать их в целевую папку
          const data = await loadsys.loadProjectJson('template', item.id);
          if (data) {
            gatherImages(data);
            const exportId = formExportId(item, doc, prefix);
            const filename = exportId + '.json';
            const name = doc && doc.name ? doc.name : exportId;

            ihpack.templates.push({ id: exportId, filename, name }); // Название хранится отдельно в таблице vistemplates??
            // Сам шаблон сохранить в папку tempFolder
            await fut.writeFileP(path.join(tempFolder, filename), data);
          }
        }
       */

    // Копировать images
    const imagepath = appconfig.getImagePath();
    for (const img of ihpack.images) {
      await fut.copyFileP(path.join(imagepath, img), path.join(tempFolder, img));
    }

    await fut.writeFileP(path.join(tempFolder, 'pack.json'), ihpack);
    return { folder: tempFolder, name: packName };
  } catch (e) {
    console.log('ERROR: exportPack: ' + util.inspect(e));
    return { error: e.message };
  }

  function gatherImages(data) {
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (data.elements[elName].type && data.elements[elName].type == 'image' && data.elements[elName].img) {
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
      // Найти документ
      const doc = await dm.findRecordById(table, item.id);

      // Найти шаблон, в нем найти все image, копировать их в целевую папку
      const data = await loadsys.loadProjectJson(param, item.id);
      if (data) {
        gatherImages(data);
        const exportId = formExportId(item, doc, prefix);
        const filename = exportId + '.json';
        const name = doc && doc.name ? doc.name : exportId;

        // ihpack.templates.push({ id: exportId, filename, name });
        // Сам шаблон сохранить в папку tempFolder
        await fut.writeFileP(path.join(tempFolder, filename), data);
        return { id: exportId, filename, name };
      }
    }
  }
}

async function formPackName(query, prefix) {
  if (query.param == 'project') return query.nodeid;

  prefix = prefix || appconfig.get('project_prefix');
  // Получить exid для query
  const doc = await dm.findRecordById(query.param, query.nodeid);
  return prefix + '@' + (doc ? getExId(doc) : query.nodeid);
}

function formExportId(item, doc, prefix) {
  if (!doc) return item.id;
  if (hut.prefAt(doc._id)) return doc._id; // id уже включает @
  return (doc.__expref || prefix) + '@' + getExId(doc);
}

function getExId(doc) {
  return doc.__exid || doc._id;
}

async function prepareToExport(query, holder) {
  if (!query.nodeid) throw { error: 'ERRGET', message: 'Missing nodeid!' };
  if (!query.param) throw { error: 'ERRGET', message: 'Missing param!' };

  const title = await getTitle();
  const url = await getUrl();

  const filename = (await formPackName(query)) + '.ihpack';

  const data = { title, url, filename };
  return { data };

  async function getTitle() {
    let res = '';
    switch (query.param) {
      case 'image':
        res = 'image ' + query.nodeid;
        break;
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
  async function getUrl() {
    return '/api/export?param=' + query.param + '&nodeid=' + query.nodeid;
  }
}

module.exports = {
  exec,
  prepareToExport
};
