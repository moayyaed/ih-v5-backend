/**
 * importPack.js
 *  Модуль извлекает из пакета элементы и добавляет в проект
 *  Возвращает массив добавленных файлов и идентификаторов ??
 *  Если не удалось извлечь - {error:'', message:''}
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

const hut = require('./hut');
const fut = require('./fileutil');

const resutil = require('../resource/resutil');

module.exports = async function(packFolder, watchid, holder) {
  // В папке содержимое пакета.  pack.json - должен быть
  const res = {};
  try {
    if (!packFolder) throw { message: 'Missing packFolder name!' };

    if (packFolder.indexOf('/') < 0) packFolder = appconfig.get('worktemppath') + '/' + packFolder;
    console.log('packFolder =' + packFolder);
    if (!fs.existsSync(packFolder)) throw { message: 'Folder not found!' };

    const ihpack = fut.readJsonFileSync(`${packFolder}/pack.json`); // throw если файла нет
    console.log('ihpack =' + util.inspect(ihpack));

    if (ihpack.images) await addImages(ihpack.images);
    if (ihpack.templates) await add('template', ihpack.templates);

  } catch (e) {
    res.error = 'ERRPACK';
    res.message = 'Package error: ' + hut.shortenErrResponse(e);
    emitWatch(res.message);
  }
  return res;

  async function addImages(images) {
    res.images = [];
    const target = appconfig.getImagePath();
    for (const img of images) {
      emitWatch('Import image ' + img);
      await fut.copyFileP(path.join(packFolder, img), path.join(target, img));
      res.images.push({ filename: img });
      await addImageToTable(img);
    }
  }

  async function add(elementType, elObj) {
    // const collection = 'vistemplates';
    // const parent = 'vistemplategroup';
    for (const item of elObj) {
      // {"id":"vam@vt087","filename":"vam@vt087.json", "name":"Lamp"}
      const _id = item.id;
      const target = path.resolve(appconfig.get('jbasepath'), elementType, _id + '.json');
      await fut.copyFileP(path.join(packFolder, item.filename), target);

      emitWatch('Import ' + elementType + ' ' + _id);
      await addToTable(elementType, formNewDoc(elementType, item));
    }
  }

  function formNewDoc(type, item) {
    const _id = item.id;
    const parent = getParent(type);
    const name = item.name ? item.name + (item.name.indexOf('@') < 0 ? ' ' + _id : '') : _id;
    return { _id, name, parent, order: 100 }; 
  }
  
  function getParent(type) {
    switch (type) {
      case 'template': return 'vistemplategroup';
      case 'dialog': return 'dialoggroup';
      default: return '';
    }
  }

  function emitWatch(message) {
    if (watchid && holder) {
      message += '\n';
      holder.emit('watch', { uuid: watchid, message });
    }
  }

  async function addImageToTable(img) {
    // Включить в таблицу images, только если пока нет
    const imgDoc = await dm.dbstore.findOne('images', { _id: img });
    if (!imgDoc) {
      const newdoc = resutil.newImageRecord(img);
      await dm.insertDocs('images', [newdoc]);
    }
  }

  async function addToTable(type, newDoc) {
    // Включить в таблицу или изменить название - возможно, может сохранять время загрузки
    const collection = 'vistemplates';

    const doc = await dm.dbstore.findOne(collection, { _id: newDoc._id });
    if (!doc) {
      await dm.insertDocs('template', [newDoc]);
    }
  }
};
