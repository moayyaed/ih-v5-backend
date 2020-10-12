/**
 * exportPack.js
 *  Модуль готовит пакет для экспорта
 *  Возвращает путь к временной папке с пакетом
 *   Если не удалось создать пакет - возвращается пустая строка
 */

const util = require('util');
const path = require('path');


const appconfig = require('../appconfig');
// const hut = require('./hut');
// const wu = require('./wrappers');
const fut = require('./fileutil');
const loadsys = require('./loadsys');


module.exports = async function (param) {
  
  if (!param) return;
  const name = 'templatePack';
  const tempFolder = appconfig.get('worktemppath')+'/'+name;

  try {
    // Создать папку для пакета. Если существует - удалить. Должна быть пустая папка
    
    fut.createEmptyFolder(tempFolder);
  } catch (e) {
    console.log('ERROR: exportPack createEmptyFolder: '+util.inspect(e));
    return '';
  }

  const objToExport = param;

  const ihpack = {};

 
  ihpack.folder = tempFolder;
  if (objToExport.templates) {
    // Выгрузка шаблонов
    ihpack.images = [];
    ihpack.templates = [];

    for (const item of objToExport.templates) {
      if (item.id) {
        // Найти шаблон, в нем найти все image, копировать их в целевую папку
        const data = await loadsys.loadProjectJson('template', item.id);
        if (data) {
          gatherImages(data);
          const filename = item.id + '.json';
          ihpack.templates.push({ id: item.id, filename }); // Название хранится отдельно в таблице vistemplates??
          // Сам шаблон сохранить в папку tempFolder
          await fut.writeFileP(path.join(tempFolder, filename), data);
        }
      }
    }

    // Копировать images
    const imagepath = appconfig.getImagePath();
    for (const img of ihpack.images) {
      await fut.copyFileP(path.join(imagepath, img), path.join(tempFolder, img));
    }

    await fut.writeFileP(path.join(tempFolder, 'pack.json'), ihpack);
    return tempFolder;


    // Упаковать
    // const dest = path.join(appconfig.get('temppath'), 'pack.zip')
 
    // wu.zipP({ src: tempFolder, dest });

    // return ihpack;
  }

  

  function gatherImages(data) {
    if (data.elements) {
      Object.keys(data.elements).forEach(elName => {
        if (data.elements[elName].type && data.elements[elName].type == 'image' && data.elements[elName].img) {
          // Если ссылка - не копировать. Это д б имя файла
          const img = data.elements[elName].img.value;
          if (img.indexOf('/')<0) {
            ihpack.images.push(img);
          }
        }
      });
    }
  }
}


