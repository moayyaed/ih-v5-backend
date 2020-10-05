/**
 * uploadfiles.js
 */

const util = require('util');
const path = require('path');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('./hut');
const wu = require('./wrappers');
const fut = require('./fileutil');
const loadsys = require('./loadsys');

/**
 *
 * @param {*} objToExport: {templates:[{id:'vt002'}]}
 * В результате создается zip файл, содержащий пакет, состоящий из
 *   ihpack.json - описание
 *   + файлы
 */
async function exportPack(objToExport) {
  if (!objToExport) return;
  const ihpack = {};

  // Создать temp folder
  const tempFolder = appconfig.getTmpFolder('ihpack');
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

    // Сохранить ihpack
    await fut.writeFileP(path.join(tempFolder, 'ihpack.json'), ihpack);

    // Упаковать
    const dest = path.join(appconfig.get('temppath'), 'pack.zip')
 
    wu.zipP({ src: tempFolder, dest });

    return ihpack;
  }

  /*
   let dest = appconfig.getTmpZipPath(folder);
  wu
    .zipP({ src: theProj, dest })
    .then(() => {
      res.download(dest); // Set disposition and send it.
    })
    .catch(e => {
      hut.logErr(e, 'Project download fail!', 'DOWNLOAD');
      res.status(500).end(hut.shortenErrResponse(e).message);
    });
    */

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


function importPack(arrayToExport) {}

module.exports = {
  importPack,
  exportPack
};
