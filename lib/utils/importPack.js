/**
 * importPack.js
 *  Модуль инсталляции пакета
 *    - извлекает из пакета элементы и добавляет в проект (template, dialog)
 *    - если в пакет проект - создает папку проекта с данными из пакета
 *    - При ошибке генерируется исключение, try-catch в вызывающем модуле
 */

// const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

// const hut = require('./hut');
const fut = require('./fileutil');

const resutil = require('../resource/resutil');
const projectutil = require('../resource/projectutil');

/**
 * @param {String} packFolder - имя папки с пакетом или проектом
 * @param {String} watchid - id процесса по подписке watch для отправки данных
 * @param {EE} holder
 */
module.exports = async function(packFolder, watchid, holder) {
  if (!packFolder) throw { message: 'Missing packFolder name!' };

  if (packFolder.indexOf('/') < 0) packFolder = appconfig.get('worktemppath') + '/' + packFolder;
  if (!fs.existsSync(packFolder)) throw { message: 'Folder not found!' };

  let imageParentTitle;

  if (appconfig.isProjectPath(packFolder)) {
    await installProject(); // Проект в виде пакета
  } else {
    imageParentTitle = await getParentTitle(resutil.newImageParent());
    await installPack();
  }

  async function installProject() {
    // Копировать проект
    let folderName = packFolder.split('/').pop();
    const _id = projectutil.formNewProjectId(folderName);
    projectutil.doCopy(packFolder, _id);

    // Добавить запись в таблицу проектов
    const parent = 'projectgroup';
    const title = appconfig.getTheProjectProp(_id, 'title') || _id; // Считать из project.json проекта
    await addToTable('project', { _id, projectfolder: _id, parent: 'projectgroup', title, order: 100 });
    const toTreeNode = await getParentTitle(parent); // Название корневой папки, в которую поместили
    const mes = `${appconfig.getMessage('Install')} ${_id}  => ${toTreeNode}`;
    emitWatch(mes);
  }

  async function installPack() {
    //  pack.json - должен быть
    const ihpack = fut.readJsonFileSync(`${packFolder}/pack.json`); // throw если файла нет

    if (ihpack.images) await addImages(ihpack.images);
    if (ihpack.templates) await add('template', ihpack.templates);
    if (ihpack.dialogs) await add('dialog', ihpack.dialogs);
  }

  async function getParentTitle(parent) {
    const rootItem = await dm.findRecordById(parent, parent);
    return rootItem && rootItem.name ? rootItem.name : parent;
  }

  async function addImages(images) {
    const target = appconfig.getImagePath();
    for (const img of images) {
      let mes = img + ' => ' + imageParentTitle;
      try {
        await fut.copyFileP(path.join(packFolder, img), path.join(target, img));
        await addImageToTable(img);
      } catch (e) {
        mes = img + appconfig.getMessage('NotFoundInPack') + ' ' + appconfig.getMessage('Skipped'); // ' not found in package. Skipped.';
      }
      emitWatch(mes);
    }
  }

  async function add(elementType, elObj) {
    for (const item of elObj) {
      // {"id":"vam@vt087","filename":"vam@vt087.json", "name":"Lamp"}
      const _id = item.id;
      const target = path.resolve(appconfig.get('jbasepath'), elementType, _id + '.json');
      await fut.copyFileP(path.join(packFolder, item.filename), target);

      const doc = formNewDoc(elementType, item);
      await addToTable(elementType, doc);

      // Название корневой папки, в которую поместили
      const toTreeNode = await getParentTitle(doc.parent); // Название корневой папки, в которую поместили
      emitWatch(doc.name + ' => ' + toTreeNode);
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
      case 'template':
        return 'vistemplategroup';
      case 'dialog':
        return 'dialoggroup';
      case 'project':
        return 'projectgroup';
      default:
        return '';
    }
  }

  function emitWatch(message) {
    if (watchid && holder) {
      message = message ? (message += '\n') : '';
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
    // Включить в таблицу или изменить название - возможно, сохранять время загрузки
    const table = getTableName(type);

    const doc = await dm.findRecordById(table, newDoc._id);
    if (!doc) {
      await dm.insertDocs(table, [newDoc]);
    }
  }

  function getTableName(type) {
    switch (type) {
      case 'template':
        return 'template';
      case 'dialog':
        return 'dialog';
      case 'project':
        return 'projects';
      default:
        throw { message: 'Unknown type for import: ' + type };
    }
  }
};
