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
// const wu = require('./wrappers');
const fut = require('./fileutil');

module.exports = async function(packFolder, watchid, holder) {
  // В папке содержимое пакета
  // pack.json - должен быть
  const res = {};
  try {
    if (!packFolder) throw { message: 'Missing packFolder name!' };

    if (packFolder.indexOf('/') < 0) packFolder = appconfig.get('worktemppath') + '/' + packFolder;
    console.log('packFolder =' + packFolder);
    if (!fs.existsSync(packFolder)) throw { message: 'Folder not found!' };
    const ihpack = fut.readJsonFileSync(`${packFolder}/pack.json`); // throw если файла нет
    console.log('ihpack =' + util.inspect(ihpack));

    const prefix = ihpack.prefix || 'user';
    if (ihpack.images) {
      res.images = [];
      // Копировать в проект
      const target = appconfig.getImagePath();
      for (const img of ihpack.images) {
        console.log('img =' + util.inspect(img));
        emitWatch('Import image '+img);
        await fut.copyFileP(path.join(packFolder, img), path.join(target, img));
        res.images.push({ filename: img });
      }
    }

    if (ihpack.templates) {
      const collection = 'vistemplates';
      const parent = 'vistemplategroup';
      for (const item of ihpack.templates) {
        // {"id":"vt087","filename":"vt087.json"}
        // Сформировать новый id
        const _id = prefix + '@' + item.id;
        const target = path.resolve(appconfig.get('jbasepath'), 'template', _id + '.json');
        await fut.copyFileP(path.join(packFolder, item.filename), target);
        emitWatch('Import template '+_id);
        // Нужно записать в vistemplates если нет пока
        const doc = await dm.dbstore.findOne(collection, { _id });
        if (!doc) {
          await dm.insertDocs('template', [{ _id, parent, name: _id, order: 100 }]);
        }
      }
    }
  } catch (e) {
    res.error = 'ERRPACK';
    res.message = 'Package error: ' + hut.shortenErrResponse(e);
    emitWatch(res.message);
  }
  return res;

  function emitWatch(message) {
    console.log('WARN: emitWatch uuid='+watchid+' '+message);
    if (watchid && holder) {
      holder.emit('watch', { uuid: watchid, message });
    }
  }
};
