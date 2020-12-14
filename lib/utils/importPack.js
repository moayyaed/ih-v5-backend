/**
 * importPack.js
 *  Модуль инсталляции пакета
 *    - извлекает из пакета элементы и добавляет в проект (template, dialog)
 *    - если в пакет проект - создает папку проекта с данными из пакета
 *
 *    - При ошибке генерируется исключение, try-catch в вызывающем модуле
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

// const hut = require('./hut');
const fut = require('./fileutil');
const wu = require('./wrappers');

const resutil = require('../resource/resutil');
const projectutil = require('../resource/projectutil');

const plugininstall = require('../plugin/plugininstall');

/**
 * @param {String} packFolder - имя папки с пакетом или проектом
 * @param {String} watchid - id процесса по подписке watch для отправки данных
 * @param {EE} holder
 */
module.exports = async function(packFolder, watchid, holder) {
  if (!packFolder) throw { message: 'Missing packFolder name!' };

  if (packFolder.indexOf('/') < 0) packFolder = appconfig.get('worktemppath') + '/' + packFolder;
  if (!fs.existsSync(packFolder)) throw { message: 'Folder not found!' };

  if (appconfig.isProjectPath(packFolder)) {
    await installProject(); // Проект в виде пакета
  } else if (appconfig.isPlugin(packFolder)) {
    // Плагин в виде пакета - читаем его .ih  файл
    const pluginInfo = appconfig.getPluginInfo(packFolder); // Если при чтении ошибка - будет throw
    await copyPlugin(pluginInfo);
    await installPlugin(pluginInfo);
    holder.dm.invalidateCache({ type: 'plugininfo', id: pluginInfo.id });
    holder.dm.invalidateCache({ type: 'manifest', id: pluginInfo.id });
  } else {
    await installPack();
  }

  async function copyPlugin(pluginInfo) {
    try {
      const pluginid = pluginInfo.id;
      emitWatch('Plugin ' + pluginid);

      const folder = appconfig.getThePluginPath(pluginid);
      fut.checkAndMakeFolder(folder);

      // emitWatch('Copy from ' + packFolder + ' to  ' + folder);
      emitWatch('Copy to  ' + folder);
      await wu.cpP({ src: packFolder, dest: folder });
    } catch (err) {
      console.log('ERROR: ImportPack error:' + util.inspect(err));
      throw err;
    }
  }

  async function installPlugin(pluginInfo) {
    if (!pluginInfo) return;

    const pluginid = pluginInfo.id;
    let mes = await plugininstall.installShIfExists(pluginid);
    emitWatch(mes);
    mes = await plugininstall.installNpmIfNeed(pluginid);
    emitWatch(mes);

    // Независимо от результатов инсталляции - плагин загружен
    // Добавить запись (или папка + запись) в таблицу плагинов
    const parent = 'unitgroup';
    await addToTable('units', { _id: pluginid, parent, title: pluginid, order: 100 });

    const toTreeNode = await getParentTitle(parent); // Название корневой папки, в которую поместили
    mes = `${appconfig.getMessage('Install')} ${pluginid}  => ${toTreeNode}`;
  }

  async function installProject() {
    // Копировать проект
    let folderName = packFolder.split('/').pop();
    let _id = projectutil.formNewProjectId(folderName);

    // Определить версию проекта. Если это проект v4 или ниже ? - пытаться его конвертировать
    if (appconfig.isV5Project(packFolder)) {
      projectutil.doCopy(packFolder, _id);
    } else {
      const mes = 'Project version: v4.0. Try transform...';
      emitWatch(mes);
      _id += '_fromV4';
      await projectutil.transferProject(packFolder, _id, (tmes) => {
        emitWatch(tmes);
      });
    }

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

    // if (ihpack.images) await addImages(ihpack.images.filter(el => !imgExclude.includes(el)));
    if (ihpack.images) await addImages(ihpack.images);
    if (ihpack.templates) await add('template', ihpack.templates);
    if (ihpack.dialogs) await add('dialog', ihpack.dialogs);
    if (ihpack.containers) await add('container', ihpack.containers);
  }

  async function getParentTitle(parent) {
    const rootItem = await dm.findRecordById(parent, parent);
    return rootItem && rootItem.name ? rootItem.name : parent;
  }

  /**
   * Добавить image
   * - Если в целевом проекте уже есть файлы с таким именем - не копируем
   * - Если нет - копируем в папку имени пакета (нужно создать папку!! если есть что копировать)
   
   * @param {Array of String} images 
   */
  async function addImages(images) {
    const imgExclude = ['unset', 'noimage.svg'];
    const added = [];

    const target = appconfig.getImagePath();
    const imageParentTitle = await getParentTitle(resutil.newImageParent());
    for (const img of images) {
      if (img && !imgExclude.includes(img)) {
        let mes = img + ' => ' + imageParentTitle;
        try {
          const filename = path.join(target, img);

          if (!fs.existsSync(filename)) {
            await fs.promises.copyFile(path.join(packFolder, img), filename);
            // await addImageToTable(img);
            added.push(img);
          } else {
            mes = img + ' exists, skipped.';
          }
        } catch (e) {
          mes = img + ' ' + appconfig.getMessage('NotFoundInPack') + ' ' + appconfig.getMessage('Skipped'); // ' not found in package. Skipped.';
        }
        emitWatch(mes);
      }
    }

    // Записать в таблицу images в папку имени пакета
    await addImgArrToTable(added);
  }

  async function add(elementType, elObj) {
    for (const item of elObj) {
      // {"id":"vam@vt087","filename":"vam@vt087.json", "name":"Lamp"}
      const _id = item.id;
      const target = path.resolve(appconfig.get('jbasepath'), elementType, _id + '.json');
      await fs.promises.copyFile(path.join(packFolder, item.filename), target);

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

      case 'container':
        return 'viscontgroup';
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

  async function addImgArrToTable(imgArr) {
    if (!imgArr || !imgArr.length) return;

    // Создать папку имени этого пакета
    const parent = packFolder.split('/').pop();
    const docs = imgArr.map(img => resutil.newImageRecord(img, parent));
    docs.push(resutil.newFolderRecord(parent));
    await dm.upsertDocs('image', docs);
  }

  /*
  async function addImageToTable(img) {
    // Включить в таблицу images, только если пока нет
    const imgDoc = await dm.dbstore.findOne('images', { _id: img });
    if (!imgDoc) {
      const newdoc = resutil.newImageRecord(img);
      await dm.insertDocs('images', [newdoc]);
    }
  }
  */

  async function addToTable(type, newDoc) {
    // Включить в таблицу
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
      case 'container':
        return 'container';
      case 'project':
        return 'project';
      case 'units':
        return 'units';
      default:
        throw { message: 'Unknown type for import: ' + type };
    }
  }
};
