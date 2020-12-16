/**
 * datamaker.js
 *
 * Выполняет операции подготовки для создания, копирования, редактирования и удаления
 * на прикладном уровне
 *
 */

const util = require('util');
const path = require('path');

const dm = require('../datamanager');
const descriptor = require('../descriptor');
const hut = require('../utils/hut');
const fileutil = require('../utils/fileutil');
const appconfig = require('../appconfig');

const virttables = require('./virttables');
const projectdata = require('./projectdata');

const typestore = require('../device/typestore');
const sceneutils = require('../scene/sceneutils');
const snippetutil = require('../snippet/snippetutil');
const projutil = require('../resource/projectutil');
const devhardutil = require('../device/devhardutil');

async function createNewDocsFromTree(nodes, table, parentid) {
  if (!nodes || !table) return [];
  // console.log('WARN: createNewDocsFromTree table=' + table);
  // console.log('WARN: createNewDocsFromTree nodes=' + util.inspect(nodes));
  const docs = [];
  const tdesc = descriptor.getDescItem('table', table);
  const defRec = descriptor.getTableDefaultRecord(table);
  if (defRec) {
    for (const item of nodes) {
      const _id = dm.numerator.getNewId(table);
      docs.push(Object.assign({ _id, parent: parentid, order: item.order }, tdesc.filter, defRec));
    }
  } else {
    for (const item of nodes) {
      item.parent = parentid;
      const doc = item._id ? item : await createOneRecord(table, tdesc.filter, item, parentid);
      if (doc) docs.push(doc);
    }
  }
  return docs;
}

async function createOneRecord(table, filter, item, parentid, body) {
  const _id = dm.numerator.getNewId(table);

  const doc = { _id, ...filter };
  if (item.order) doc.order = item.order;
  if (item.parent) doc.parent = item.parent;

  console.log('WARN: CREATE ONE REC  ' + table + ' doc=' + util.inspect(doc) + ' item=' + util.inspect(item));

  // ЗДЕСЬ можно делать разные вещи для таблиц
  switch (table) {
    case 'device':
      return typestore.createDeviceDoc(doc, item.popupid);

    case 'units':
      if (item.popupid) {
        doc._id = item.popupid;
        doc.id = item.popupid;
        doc.active = 1;
        doc.suspend = 1;  
        if (item.popupid.startsWith('plugin_')) {
          doc.folder = 1;
          doc.name = item.popupid.substr(7).toUpperCase();
        } else {
          doc.plugin = hut.removeLastNumFromStr(item.popupid);
        }

      }
      return doc;

      case 'dbagent':
        if (item.popupid) {
          doc._id = item.popupid;
          doc.id = item.popupid;
          doc.active = 1;
          doc.suspend = 1;  
          doc.title = item.popupid;
          appconfig.setProjectProp('dbname', item.popupid);  // Записать в project.json проекта dbname - это будет используемый dbagent

        }
        return doc;

    case 'devicedb':
      // doc={ _id: 'XVafGoU3c', id: 'value', nodeid: 'd0034' }
      // item={ dbmet: 1, dbdelta: '2', dbforce: '60' }
      return { _id: doc._id, did: doc.nodeid, prop: doc.id, ...item };

    case 'globals':
    case 'locals':
      doc.name = 'New var';
      doc.dn = 'var' + hut.getRandomInt(1, 1000);
      doc.defval = 0;
      return doc;

    case 'devhard':
      return devhardutil.createDevhardDoc(doc, item, body);

    case 'scene':
      doc.status = 0;
      doc.name = 'New script';
      // Копировать шаблонный скрипт
      await sceneutils.createNewScriptFromTemplate(doc._id);
      return doc;

    case 'multiscene':
      if (item.popupid) {
        doc._id = item.popupid;
        doc.id = item.popupid;
        doc.title = item.popupid;
      }
      return doc;
  

    case 'scenecall':
      doc.sid = parentid;

      Object.keys(item).forEach(prop => {
        // При добавлении новой строки, если droplist не был выбран, передается {id: "-", title: "-"}
        // Предварительную проверку этого выполняет validator.preValidateTable
        if (item[prop] && typeof item[prop] != 'object') doc[prop] = item[prop];
      });

      return doc;

    case 'snippet':
      doc.status = 0;
      doc.name = 'New snippet';
      // Копировать шаблонный скрипт
      await snippetutil.createNewSnippet(doc._id);
      return doc;

    case 'unitextTable':
      doc.unit = parentid;
      return { ...doc, ...item };

    case 'project':
      projutil.createProject(doc);
      return doc;

    default:
      return doc;
  }
}

async function copyDocsFromTree(nodes, table, target, seqObj) {
  const tdesc = descriptor.getDescItem('table', table);

  // Считать записи, заменить parent на targetid, в название добавить (copy)
  const arr = nodes.map(item => item.nodeid);
  const filter = hut.createIdsInFilter(arr);
  const docs = await dm.dbstore.get(tdesc.collection, filter);

  for (const doc of docs) {
    await copypasteDoc(table, doc, target, seqObj);
  }

  return docs;
}

async function copyOneFromTree(node, table, target, seqObj) {
  const tdesc = descriptor.getDescItem('table', table);
  const doc = await dm.dbstore.findOne(tdesc.collection, { _id: node.id });
  if (doc) await copypasteDoc(table, doc, target, seqObj);
  return doc;
}

async function copypasteDoc(table, doc, target, seqObj) {
  const oldId = doc._id;
  doc.order = seqObj && seqObj[doc._id] ? seqObj[doc._id] : doc.order;
  doc._id = dm.numerator.getNewId(table);
  doc.parent = target;

  switch (table) {
    case 'type':
      doc.name += ' (copy)'; // name+copy
      await typestore.copyHandlers(oldId, doc._id);
      break;

    case 'devhard': // При копировании канала привязку к устройству не копировать!!
      doc.chan += '_COPY';
      doc.did = '';
      doc.prop = '';
      break;

    case 'device':
      doc.name += ' (copy)'; // name+copy
      doc.dn = typestore.getNewDnAsCopy(doc.dn);
      break;

    case 'scene':
      doc.status = 0;
      doc.name += ' (copy)';
      // Копировать файл скрипта
      await fileutil.copyFileP(appconfig.getScriptFilename(oldId), appconfig.getScriptFilename(doc._id));
      break;

    case 'snippet':
      doc.status = 0;
      doc.name += ' (copy)';
      // Копировать файл скрипта
      await fileutil.copyFileP(appconfig.getSnippetFilename(oldId), appconfig.getSnippetFilename(doc._id));
      break;

    case 'layout':
    case 'container':
    case 'template':
    case 'dialog':
      doc.status = 0;
      doc.name += ' (copy)';

      // Копировать файл с контентом
      await fileutil.copyFileP(visFilename(table, oldId), visFilename(table, doc._id));
      break;

    case 'globals':
    case 'locals':
      doc.name += ' (copy)';
      doc.dn += hut.getRandomInt(1, 1000);
      return doc;

    case 'user':
      doc.login += '1';
      return doc;

    case 'project':
      return projutil.copyProject(doc);

    default:
      doc.name += ' (copy)'; // name+copy
  }
}

async function beforeUpdate(table, doc) {
  console.log('BEFORE UPDATE ' + table + ' doc=' + util.inspect(doc));
  switch (table) {
    case 'device':
      // Проверить, если изменился тип - нужно изменить props, то есть полностью переписать
      if (doc.$set && doc.$set.type && doc.type != doc.$set.type) {
        // Получить новый props для типа - весь вложенный объект будет заменен
        doc.$set.props = typestore.createPropsFromType(doc.$set.type);
      }
      break;

    case 'scene':
      console.log('scene beforeUpdate');
      break;

    case 'devhard':
      // Если меняют привязку, проверить, что предыдущая привязка удалена и удалить если есть
      if (doc.$set && doc.$set.did && doc.$set.prop) {
        // Приходит всегда парой did, prop
        await devhardutil.removeOldDevlinkBeforeUpdate(doc.$set.did, doc.$set.prop);
      }
      break;

    case 'project':
      // Сохранить title в project.json и/или переименовать папку проекта
      if (doc.$set) {
        await projutil.updateProjectProps(doc);
      }
      break;

    case 'scenecall':
      /*
      BEFORE UPDATE scenecall doc={
        _id: 'call004',
        sid: 'scen004',
        id: '__aSh8jW5ZK',
        lamp: 'd0012',
        motion: 'd0008',
        '$set': { lamp: 'd0004' }
      }
      */
      //
      break;

    default:
  }
}

/*
function processDevicedbBeforeUpdate(doc) {
  if (!doc.$set) return;

  // Массив имен измененных свойств??
  const updatedProps = hut.getPropNamesArrayFromSetObj(doc.$set);

  // Для каждого измененного свойства
  //  - создать результирующий объект, куда включить все атрибуты
  //  - добавить нужные или удалить ненужные атрибуты

  updatedProps.forEach(prop => {
    const nObj = hut.getAttrsObjFromSetObj(doc.$set, prop); // изменяемые атрибуты
    const resObj = { ...doc.props[prop], ...nObj };

    if (resObj.dbmet == 1) {
      // При изменении - обязательных нет, дельта м б 0,
      needlessAttr(prop, resObj, { dbtm: 1, dbcalc_type: 1 });
    } else if (resObj.dbmet == 2) {
      // Все значения
      needlessAttr(prop, resObj, { dbtm: 1, dbcalc_type: 1, dbdelta: 1 });
    } else if (resObj.dbmet == 3) {
      // Периодически - нужен период и calc_type
      needAttr(prop, resObj, { dbtm: 30, dbcalc_type: 'minmax' });
      needlessAttr(prop, resObj, { dbdelta: 1 });
    } else {
      // Не сохранять - можно убрать все свойство целиком
      if (!doc.$unset) doc.$unset = {};
      doc.$unset['props.' + prop] = 1;
    }
  });

  function needAttr(prop, robj, need) {
    // Нужных нет нигде - просто добавить в set c переданным значением
    Object.keys(need).forEach(attr => {
      if (!robj[attr] || robj[attr] == 0 || robj[attr] == '-') {
        doc.$set['props.' + prop + '.' + attr] = need[attr];
      }
    });
  }

  function needlessAttr(prop, robj, needless) {
    // Есть ненужные атрибуты
    // Если уже в оcновном док-те: Поместить в $unset, удалить из set
    // Если  в оcновном нет -  просто удалить из set
    Object.keys(needless).forEach(attr => {
      if (robj[attr]) {
        if (doc.props[prop]) {
          if (!doc.$unset) doc.$unset = {};
          doc.$unset['props.' + prop + '.' + attr] = 1;
        }
        delete doc.$set['props.' + prop + '.' + attr];
      }
    });
  }
}
*/

async function findOrAddDoc(collection, _id) {
  const spec = ['devicedb'];
  const olddoc = await dm.dbstore.findOne(collection, { _id });
  if (olddoc) return olddoc;

  if (spec.includes(collection)) {
    switch (collection) {
      case 'devicedb':
      default:
        await dm.dbstore.insert(collection, { _id, props: {} });
        return dm.dbstore.findOne(collection, { _id });
    }
  }
  throw new Error('Not found doc: _id = ' + _id + ', collection ' + collection);
}

async function beforeRemove(table, doc) {
  await checkDocCanBeRemoved(table, doc);

  switch (table) {
    case 'units':
      // Если удаляется экземпляр или одиночный плагин - удалить его каналы 
      await devhardutil.removeUnitChannels(doc._id);
      break;

    case 'dbagent':
      // Удаляется dbagent - сбросить dbname
      appconfig.setProjectProp('dbname', "");  
      break;

    case 'image':
      // Удалить файл картинки
      fileutil.delFileSync(appconfig.getImagePath() + '/' + doc._id);
      break;

    case 'scene':
      // Удалить файл скрипта
      sceneutils.removeScriptFile(doc._id);
      break;

    case 'snippet':
      // Удалить файл скрипта
      snippetutil.removeScriptFile(doc._id);
      break;

    case 'layout':
    case 'container':
    case 'template':
    case 'dialog':
      // Удалить файлы контента
      fileutil.delFileSync(visFilename(table, doc._id));
      // Сбросить кэш
      visInvalidateCache(table, doc._id);
      break;

    case 'project':
      // Удалить всю папку проекта
      await projutil.removeProject(doc, dm);
      break;

    default:
  }
}

async function checkDocCanBeRemoved(table, doc) {
  let items;
  switch (table) {
    case 'type':
      items = await dm.dbstore.get('devices', { type: doc._id }, { fields: { dn: 1, type: 1 } });
      if (items.length) {
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Найдено устройств типа ' + doc.name + ': ' + items.length
        };
      }
      break;

    case 'template':
      items = await getTemplateUsage(doc._id);
      if (items.length)
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Шаблон используется, найдено элементов: ' + items.length
        };
      break;

      case 'snippet':
      items = await getSnippetUsage(doc._id);
      if (items.length)
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Сниппет используется, найдено элементов: ' + items.length
        };
      break;
      

    case 'device':
    case 'globals':
    case 'locals':
      // Если есть привязки к визуализации - возвращает счетчик привязок
      items = await getDeviceVisLinksCount(doc._id);
      if (items > 0)
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Найдено ссылок на визуализацию: ' + items
        };

      // TODO - или к сценариям

      break;

    case 'project':
      // Текущий проект удалить нельзя - нужно сравнить с текущим проектом!!
      if (doc._id == appconfig.get('project')) {
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Текущий проект удалить нельзя!'
        };
      }
      break;
    default:
  }
}

async function getDeviceVisLinksCount(id) {
  // Число (счетчик) привязок к визуализации
  const items = await getDeviceVisUsage(id);
  return items.reduce((count, item) => count + (item.content_str ? item.content_str.split(';').length : 0), 0);
}

async function getDeviceVisUsage(id) {
  const table = 'devicevisTable';
  return virttables[table]([], table, id);
}

async function getTemplateUsage(id) {
  const table = 'templateusageTable';
  return virttables[table]([], table, id);
}

// snippetusageTable
async function getSnippetUsage(id) {
  const table = 'snippetusageTable';
  return virttables[table]([], table, id);
}

async function customValidate({ prop, doc, _id, table }) {
  // console.log('WARN: customValidate START prop=' + prop + ' table=' + table + ' id=' + _id);
  let res;
  switch (table) {
    case 'devhard':
      res = await devhardutil.customValidate({ prop, doc, _id });
      return res;
 

    default:
  }
}

async function saveExField(exFieldItem, field, nodeid, value) {
  let retObj;
  let prevObj;
  switch (exFieldItem.type) {
    case 'code':
    case 'script':
      if (field == 'handler') {
        retObj = await saveHandler(nodeid, value);
        // typestore.reloadHandler(nodeid);
      } else {
        retObj = await saveScript(nodeid, value);
      }

      break;

    case 'layout':
    case 'container':
    case 'dialog':
      await saveVisFile(exFieldItem.type, nodeid, value);
      break;

    case 'template':
      // Прежде чем сохранить, считать предыдущий файл шаблона - для дальнейшей обработки
      prevObj = await projectdata.getCachedProjectObj('template', nodeid);
      await saveVisFile(exFieldItem.type, nodeid, value);
      await processContainersWithTemplate(nodeid, prevObj, value);
      break;

    default:
  }
  return retObj;
}

async function saveHandler(nodeid, value) {
  // При сохранении проверить module.exports = function
  // retObj = await processHandlerStrBeforeSaveToFile(nodeid, value);
  const filename = appconfig.getHandlerFilename(nodeid);
  hut.unrequire(filename);
  await fileutil.writeFileP(filename, value);
  const [typeId, prop] = nodeid.split('.');
  return typestore.requireHandler(typeId, prop);
}

async function saveScript(nodeid, value) {
  // sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw
  let res;
  let filename;
  let event;
  if (nodeid.startsWith('snippet')) {
    filename = appconfig.getSnippetFilename(nodeid);
    event = 'saved:snippet';
    // await fileutil.writeFileP(filename, value);
  } else {
    filename = appconfig.getScriptFilename(nodeid);
    // sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw
    res = await sceneutils.processScriptFile(nodeid, {}, value); // Это валидация. Если будет ошибка - throw
    event = 'saved:script';
  }
 
  hut.unrequire(filename); 
  await fileutil.writeFileP(filename, value);

  dm.emit(event, nodeid);
  return res;
}

function visFilename(folder, nodeid) {
  return path.resolve(appconfig.get('jbasepath'), folder, nodeid + '.json');
}

function visInvalidateCache(folder, nodeid) {
  dm.invalidateCache({ type: 'pobj', id: folder, nodeid });
  dm.invalidateCache({ type: 'uppobj', id: folder, nodeid });
}

async function saveVisFile(type, nodeid, value) {
  const filename = visFilename(type, nodeid);
  await fileutil.writeFileP(filename, value); // stringify внутри
  visInvalidateCache(type, nodeid);
}

/**
 * Если в шаблоне есть удаленные переменные шаблона или actions - нужно удалить в контейнерах, которые исп шаблон
 * @param {String} templateId - id шаблона (имя файла)
 * @param {Object} prevObj - шаблон до редактирования
 * @param {Object} newObj  - шаблон после редактирования
 */
async function processContainersWithTemplate(templateId, prevObj, newObj) {
  // Найти, где используется этот шаблон
  const usageArr = getTemplateUsage(templateId); // [{container_id, template_id, element},...]
  if (!usageArr.length) return; // Если шаблон не используется - то дальше не проверяем

  // Сравнить шаблоны на предмет удаленных элементов
  const removedVarsAndActions = projectdata.findRemovedVarsAndActionsForTemplate(prevObj, newObj);

  if (removedVarsAndActions.length) {
    // Группировать по контейнерам, которые исп шаблон
    const contSet = hut.arrayToGroupObjectWithElementArray(usageArr);

    // Обработать каждый контейнер
    for (const containerId of Object.keys(contSet)) {
      const newContent = await projectdata.removeVarsAndActionsFromContainer(
        containerId,
        templateId,
        removedVarsAndActions
      );
      if (newContent) {
        saveVisFile('container', containerId, newContent); // без  await - Результат записи не ожидаем
      }
    }
  }
}

// При редактировании таблицы - менять другие таблицы (smartbutton)
async function processTableSpecField(nodeid, rowid, field, fieldItem) {
  // smartbutton2 для dn_prop
  if (field == 'dn_prop') {
    // Привязка - приходит {id:"d0022", prop:'state', dn:'DN002', title:'DN002.value'} id-did устройства
    // Отвязка  - приходит {value:{}}??
    return fieldItem.dn && fieldItem.prop ? fieldItem.dn+'.'+fieldItem.prop : '-';
  }

  // smartbutton для chanlink
  if (field == 'chanlink') {
    // Привязка - приходит {id:"xxxxx", prop:'modbus1.ch42'} id-запись в devhard
    // Отвязка  - приходит {value:{}, title:"", path:""}
    const did = nodeid;
    const prop = rowid;

    if (!did || !prop || !fieldItem || (!fieldItem.id && !fieldItem.value)) return;

    // Перед привязкой нужно отвязать этот did+prop (в таблице одновременно происходит отвязка+привязка )
    let docs = await dm.dbstore.get('devhard', { did, prop });

    if (docs) {
      docs.forEach(doc => {
        doc.$set = { did: '', prop: '' };
      });
    } else {
      docs = [];
    }

    if (fieldItem.id) {
      const _id = fieldItem.id;
      const doc = await dm.dbstore.findOne('devhard', { _id });
      if (!doc) throw { message: 'Not found channel record: id =' + _id };

      doc.$set = { did, prop };
      docs.push(doc);
    }

    if (docs.length) {
      await dm.updateDocs('devhard', docs);
    }
    
  }
}

module.exports = {
  createNewDocsFromTree,
  createOneRecord,
  copyDocsFromTree,
  copyOneFromTree,
  findOrAddDoc,
  beforeUpdate,
  beforeRemove,
  customValidate,
  saveExField,
  processTableSpecField
};
