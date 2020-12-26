/**
 * importPack.js
 *  Модуль инсталляции пакета
 *    - извлекает из пакета элементы и добавляет в проект (template, dialog)
 *    - если в пакете проект - создает папку проекта с данными из пакета
 *      - если проект версии V4 - выполняется перенос данных
 *
 *    - если в пакет плагин - инсталлирует плагин
 *    - если в пакет dbagent - инсталлирует dbagent
 *
 *    - При ошибке генерируется исключение, try-catch в вызывающем модуле
 */

// const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

// const hut = require('./hut');
const fut = require('./fileutil');

const imageutil = require('../utils/imageutil');
const projectutil = require('../utils/projectutil');

const pluginutil = require('../plugin/pluginutil');
const dbagentutil = require('../dbs/dbagentutil');
// const plugininstall = require('../plugin/plugininstall');

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
    await installProject();
  } else if (appconfig.isDbagent(packFolder)) {
    // Если есть файл dbagent.ih - это dbagent
    await installDbagent();
  } else if (appconfig.isPlugin(packFolder)) {
    // Если есть любой другой файл .ih - это плагин
    await installPlugin();
  } else {
    await installPack();
  }

  /**
   * installDbagent
   * - читает файл dbagent.ih
   * - устанавливает в папку agents
   * - cбрасывает кэш метаданных - формы, файл .ih
   *
   *  Если модуль уже есть - файлы перезаписываются (но не удаляются)
   *  @throw -  если нет файла .ih или ошибка при установке
   */
  async function installDbagent() {
    const info = appconfig.getDbagentInfo(packFolder);
    if (!info || !info.id) throw { message: 'File .ih missing or invalid!' };

    info.dbagent = true;
    await pluginutil.install(packFolder, info, tmes => emitWatch(tmes));
    dbagentutil.invalidateCache(info.id, holder.dm);

    // Если добавляется новый агент - пользователь сам должен активировать? Но в дерево добавим
    const doc = await dbagentutil.prepareDocAfterInstall(info.id, holder);
    return afterPluginInstall('dbagent', doc);
  }

  /**
   * installPlugin
   * - читает файл .ih - первый найденный (должен быть один)
   * - устанавливает в папку plugins
   * - cбрасывает кэш метаданных - формы, файл .ih
   *
   *  Если модуль уже есть - файлы перезаписываются (но не удаляются)
   *  @throw -  если нет файла .ih или ошибка при установке
   */
  async function installPlugin() {
    // Плагин - читаем его .ih  файл
    const pluginInfo = appconfig.getPluginInfo(packFolder);
    if (!pluginInfo || !pluginInfo.id) throw { message: 'File .ih missing or invalid!' };

    const pluginid = pluginInfo.id;
    await pluginutil.install(packFolder, pluginInfo, tmes => emitWatch(tmes));
    pluginutil.invalidateCache(pluginid, holder.dm);

    // Если плагина нет - добавить папку или одиночный плагин
    const doc = await pluginutil.prepareUnitDocAfterInstall(pluginid, holder);
    return afterPluginInstall('units', doc);
  }

  async function afterPluginInstall(table, doc) {
    if (doc) {
      await addToTable(table, doc);
      const toTreeNode = await getParentTitle(doc.parent);
      const mes = `${appconfig.getMessage('Install')} ${doc.name}  => ${toTreeNode}`;
      emitWatch(mes);
    } else {
      // Нужно перезапустить??
      emitWatch('Update OK');
    }
  }

  async function installProject() {
    // Копировать проект
    let folderName = packFolder.split('/').pop();
    let _id;

    // Определить версию проекта. Если это проект v4 или ниже ? - пытаться его конвертировать
    if (appconfig.isV5Project(packFolder)) {
      _id = projectutil.formNewProjectId(folderName);
      projectutil.doCopy(packFolder, _id);
    } else {
      // TODO Считать версию проекта из project.json
      // const mes = 'Project version: v4.0. Try transform...';
      const mes = 'Проект версии V4. Запущена процедура миграции...';
      emitWatch(mes);
      _id = projectutil.formNewProjectId(folderName+'_fromV4');
      await projectutil.transferProject(packFolder, _id, tmes => {
        emitWatch(tmes);
      });
    }

    // Добавить запись в таблицу проектов
    const parent = 'projectgroup';
    const title = appconfig.getTheProjectProp(_id, 'title') || _id; // Считать из project.json проекта
    await addToTable('project', { _id, projectfolder: _id, parent: 'projectgroup', title, order: 100 });
    /** 
    const toTreeNode = await getParentTitle(parent); // Название корневой папки, в которую поместили
    const mes = `${appconfig.getMessage('Install')} ${_id}  => ${toTreeNode}
    Для активации проекта 
    `;
    */
   const mes = `Миграция завершена.
Проект помещен в дерево проектов под именем  ${_id}.
Для активации проекта перейдите в Настройки и нажмите "Перезагрузить сервер с этим проектом".  

Учетные данные в целях безопасности не переносятся.
Стандартный вход Login:admin, Password:202020
`;
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
    // const imgExclude = ['unset', 'noimage.svg'];
    const added = [];

    const target = appconfig.getImagePath();
    const imageParentTitle = await getParentTitle(imageutil.newImageParent());
    for (const img of images) {
      if (img && !imageutil.imgExclude.includes(img)) {
        let mes = img + ' => ' + imageParentTitle;
        try {
          const filename = path.join(target, img);

          if (!fs.existsSync(filename)) {
            await fs.promises.copyFile(path.join(packFolder, img), filename);
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
    const docs = imgArr.map(img => imageutil.newImageRecord(img, parent));
    docs.push(imageutil.newFolderRecord(parent));
    await dm.upsertDocs('image', docs);
  }

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
      case 'dbagent':
        return 'dbagent';
      default:
        throw { message: 'Unknown type for import: ' + type };
    }
  }
};
