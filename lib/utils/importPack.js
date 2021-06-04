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

const util = require('util');
const fs = require('fs');
const path = require('path');

const appconfig = require('../appconfig');

const hut = require('./hut');
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
  const dm = holder.dm;
  if (!packFolder) throw { message: 'Missing packFolder name!' };

  // Такой вариант для Windows не работает? Передавать всегда полный путь
  // if (packFolder.indexOf('/') < 0) packFolder = appconfig.get('worktemppath') + '/' + packFolder;

  if (!fs.existsSync(packFolder)) throw { message: 'Folder not found: ' + packFolder };

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

    const pstr = appconfig.getMessage('PLUGIN') + ' ' + pluginInfo.id;
    // const err_only5 = 'Система работает только с плагинами версии 5.'; needPluginV5
    const err_only5 = appconfig.getMessage('needPluginV5');

    // if (!pluginInfo.version) throw { message: pstr + '. Отсутствует информация о версии плагина! ' + err_only5 };
    if (!pluginInfo.version) throw { message: pstr + appconfig.getMessage('misPluginVersion') + ' '+err_only5 };
    if (!pluginInfo.version.startsWith('5.')) throw { message: pstr + ' v' + pluginInfo.version + '. ' + err_only5 };

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
      const toTreeNode = await getParentTitle(doc.parent, doc.parent);
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
    let v4;
    if (appconfig.isV5Project(packFolder)) {
      _id = projectutil.formNewProjectId(folderName);
      projectutil.doCopy(packFolder, _id);
    } else {
      v4 = true;
      // TODO Считать версию проекта из project.json
      const mes = appconfig.getMessage('StartV4migration'); // 'Проект версии V4. Запущена процедура миграции...';
      emitWatch(mes);
      _id = projectutil.formNewProjectId(folderName + '_fromV4');
      await projectutil.transferProject(packFolder, _id, tmes => {
        emitWatch(tmes);
      });
    }

    // Добавить запись в таблицу проектов
    const title = appconfig.getTheProjectProp(_id, 'title') || _id; // Считать из project.json проекта
    await addToTable('project', { _id, projectfolder: _id, parent: 'projectgroup', title, order: 100 });

    let mes = appconfig.getMessage('projectSavedInFolder') + ' "' + _id + '"\n';
    mes += appconfig.getMessage('projectTitle') + ': '+title+'\n';

    // let mes = 'Проект сохранен в папку "' + _id + '" ' + (title ? ' под именем "' + title + '"' : '') + '\n';
    mes += appconfig.getMessage('toActivateProject') + '\n';

    if (v4) mes += appconfig.getMessage('CredentialsNotMigrated');
    console.log('INFO: emitWatch mes=' + mes);
    emitWatch(mes);
  }

  async function installPack() {
    const file = `${packFolder}/pack.json`;
    //  pack.json - должен быть
    if (fs.existsSync(file)) {
      const ihpack = fut.readJsonFileSync(file); // throw если файла нет

      // if (ihpack.images) await addImages(ihpack.images.filter(el => !imgExclude.includes(el)));
      if (ihpack.images) await addImages(ihpack.images);
      if (ihpack.templates) await add('template', ihpack.templates);
      if (ihpack.dialogs) await add('dialog', ihpack.dialogs);
      if (ihpack.containers) await add('container', ihpack.containers);
      if (ihpack.types) await addTypes(ihpack.types);
    } else {
      // Может быть zip архив только с изображениями
      const files = await fs.promises.readdir(packFolder);
      await addImages(files);
    }
  }

  async function getParentTitle(table, parentId) {
    const parentItem = await dm.findRecordById(table, parentId);
    return parentItem && parentItem.name ? parentItem.name : parentId;
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
    if (!images || !images.length) return;

    const target = appconfig.getImagePath();
    const imageParentTitle = await getParentTitle('imagegroup', imageutil.newImageParent());
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

      // Название корневой папки, в которую поместили (table:layoutgroup, _id:layoutgroup )
      const toTreeNode = await getParentTitle(doc.parent, doc.parent);
      emitWatch(doc.name + ' => ' + toTreeNode);
    }
  }

  async function addTypes(elObj) {
    for (const item of elObj) {
      // {"id":"vam@vt087","filename":"vam@vt087.json", "name":"Lamp" + }

      // копировать файлы в папку handlers по списку handlers
      if (item.handlers) {
        for (const hname of item.handlers) {
          const target = path.resolve(appconfig.get('handlerpath'), hname);
          await fs.promises.copyFile(path.join(packFolder, hname), target);
          // Сделать unreq, если файл уже был!!
          hut.unrequire(target);
        }
      }
      delete item.handlers;

      // Если такой тип уже есть - сравнить и формировать $set, $unset!!
      const doc = await insertOrUpdateIfExists('type', Object.assign(item, formNewDoc('type', item)));
      if (doc) {
        // Название корневой папки, в которую поместили
        const toTreeNode = await getParentTitle('typegroup', doc.parent);
        emitWatch(doc.name + ' => ' + toTreeNode);
      } else {
        // emitWatch('Ошибка при переносе типа! Подробности в логе системы');
        emitWatch(appconfig.getMessage('TypeImportError'));
      }
    }
  }

  async function insertOrUpdateIfExists(table, doc) {
    try {
      const olddoc = await dm.findRecordById(table, doc._id);
      if (!olddoc) {
        await dm.insertDocs(table, [doc]);
      } else {
        formSetUnset(doc, olddoc);
        if (olddoc.$set || olddoc.$unset) {
          await dm.updateDocs('type', [olddoc]);
        }
      }
      return doc; // Вернем новый документ - там name, parent
    } catch (e) {
      console.log('ERROR: update doc ' + util.inspect(doc) + '. ' + util.inspect(e));
    }
  }

  function formSetUnset(doc, olddoc) {
    // Сравнить и формировать $set, $unset
    olddoc.$set = {};
    olddoc.$unset = {};
    // Плоские поля - берем только те, что есть в существующем
    // parent сохранить старый, другие поля заменять
    Object.keys(olddoc).forEach(prop => {
      if (prop == 'parent') {
        doc.parent = olddoc.parent;
      } else if (typeof olddoc[prop] != 'object') {
        if (doc[prop] != undefined && doc[prop] != olddoc[prop]) {
          olddoc.$set[prop] = doc[prop];
        }
      }
    });

    // props: {} - могли добавить или удалить, поэтому надо с двух сторон
    /*
          // doc.$set:{
          //  'props.value.min': '2',
    */

    Object.keys(olddoc.props).forEach(prop => {
      if (doc.props) {
        if (!doc.props[prop]) {
          // Удалено свойство
          olddoc.$unset['props.' + prop] = 1;
        } else {
          // Может быть изменено
          Object.keys(doc.props[prop]).forEach(attr => {
            if (doc.props[prop][attr] != olddoc.props[prop][attr]) {
              olddoc.$set['props.' + prop + '.' + attr] = doc.props[prop][attr];
            }
          });
        }
      }
    });

    if (doc.props) {
      Object.keys(doc.props).forEach(prop => {
        if (!olddoc.props[prop]) {
          // Добавлено свойство
          doc.props[prop].forEach(attr => {
            olddoc.$set['props.' + prop + '.' + attr] = doc.props[prop][attr];
          });
        }
      });
    }
    if (hut.isObjIdle(olddoc.$set)) delete olddoc.$set;
    if (hut.isObjIdle(olddoc.$unset)) delete olddoc.$unset;
  }

  function formNewDoc(type, item) {
    const _id = item.id;
    const parent = getParent(type); // Корневой
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
      case 'type':
        return 'typegroup';
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

    // Создать папку имени этого пакета - с префиксом img_
    // (НЕЛЬЗЯ СОЗДАВАТЬ папку с тем же именем, как например, компонент - происходит наложение id в дереве (Компоненты+Изображения)
    const parent = 'img_' + packFolder.split('/').pop();
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
      case 'type':
        return 'type';
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
