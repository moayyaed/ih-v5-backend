/**
 * datamaker.js
 *
 * Выполняет операции подготовки для создания, копирования, редактирования и удаления
 * на прикладном уровне
 *
 */

const util = require('util');
const path = require('path');

const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const fileutil = require('../utils/fileutil');
const projutil = require('../utils/projectutil');

const pluginutil = require('../plugin/pluginutil');

const virttables = require('../domain/virttables');
const importmethods = require('../domain/importmethods');
const domaindata = require('../domain/domaindata');
const projectdata = require('./projectdata');

const typestore = require('../device/typestore');
const deviceutil = require('../device/deviceutil');
const devhardutil = require('../device/devhardutil');
const dbagentutil = require('../dbs/dbagentutil');
const httprestutil = require('../httprest/httprestutil');
const handlerutil = require('../device/handlerutil');

const sceneutils = require('../scene/sceneutils');
const snippetutil = require('../snippet/snippetutil');

async function createOneRecord({ table, filter, item, parentid, body }, dm) {
  const _id = dm.numerator.getNewId(table);

  const doc = { _id, ...filter };
  if (item.order) doc.order = item.order;
  if (item.parent) doc.parent = item.parent;

  // console.log('WARN: CREATE ONE REC  ' + table + ' doc=' + util.inspect(doc) + ' item=' + util.inspect(item));

  // ЗДЕСЬ можно делать разные вещи для таблиц
  switch (table) {
    case 'device':
      return typestore.createDeviceDoc(doc, item.popupid);

    case 'infogroup_bygroup':
      return { _id, groupId: parentid, userId: item.userId };
    case 'infogroup_byuser':
      return { _id, groupId: item.groupId, userId: parentid };
    case 'inforule_byrule':
      return { _id, ruleId: parentid, ...item };

    case 'units':
      if (item.popupid) {
        doc._id = item.popupid;
        doc.id = item.popupid;
        if (item.popupid.startsWith('plugin_')) {
          doc.folder = 1;
          doc.name = item.popupid.substr(7).toUpperCase();
          return doc;
        }
        return pluginutil.createNewUnitDoc(doc, hut.removeLastNumFromStr(item.popupid));
      }
      break;

    case 'dbagent':
      return dbagentutil.createNewDoc(doc, item.popupid);

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
      return devhardutil.createDevhardDoc(doc, item, body, dm);

    case 'scene':
      doc.status = 0;
      doc.name = 'New script';
      // Копировать шаблонный скрипт
      await sceneutils.createNewScriptFromTemplate(doc._id);
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

    case 'restapihandler':
      doc.status = 0;
      doc.name = appconfig.getMessage('NewRoute');
      // Копировать шаблонный скрипт
      await httprestutil.createNewScript(doc._id);
      return doc;

    case 'unitextTable':
      doc.unit = parentid;
      return { ...doc, ...item };

    case 'project':
      projutil.createProject(doc);
      return doc;

    case 'jlevels':
      return { ...doc, ...item };
    default:
      return doc;
  }
}

async function copypasteDoc({ table, doc, target, seqObj }, dm) {
  // console.log('copypasteDoc table=' + table + ' doc=' + util.inspect(doc) + ' target=' + util.inspect(target));
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

    case 'units':
      if (doc.folder) throw { message: 'Недопустимая операция!' };
      return pluginutil.copyUnitDoc(oldId, doc, target, dm);

    case 'device':
      doc.name += ' (copy)'; // name+copy
      doc.dn = typestore.getNewDnAsCopy(doc.dn);
      // копировать правила записи в БД
      await copyDbdocs(oldId, doc._id);

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

    case 'restapihandler':
      doc.status = 0;
      doc.name += ' (copy)';
      // Копировать файл скрипта
      await fileutil.copyFileP(
        appconfig.getRestapihandlerFilename(oldId),
        appconfig.getRestapihandlerFilename(doc._id)
      );
      return doc;

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

  async function copyDbdocs(olddid, newdid) {
    // копировать правила записи в БД
    const dbdocs = await dm.dbstore.get('devicedb', { did: olddid });
    if (dbdocs.length) {
      const newDocs = dbdocs.map(dbdoc => {
        const { _id, ...newDoc } = dbdoc;
        newDoc.did = newdid;
        return newDoc;
      });
      // Делается не insertDocs(), чтобы не генерировать преждевременно inserted:devicedb - устройства пока нет
      // Событие генерируется в devicemate при обработке inserted:device
      await dm.dbstore.insert('devicedb', newDocs);
    }
  }
}

async function cloneDoc({ table, doc, target, body, seqObj }, dm) {
  // const oldId = doc._id;

  doc.order = seqObj && seqObj[doc._id] ? seqObj[doc._id] : doc.order;
  doc._id = dm.numerator.getNewId(table);
  doc.parent = target;

  switch (table) {
    case 'devhard': // При копировании канала привязку к устройству не копировать!!
      return devhardutil.cloneDevhardDoc(doc, body, dm);

    default:
      throw { message: 'Операция клонирования не предусмотрена!!' };
  }
}

async function beforeUpdate(table, doc, dm) {
  // console.log('BEFORE UPDATE ' + table + ' doc=' + util.inspect(doc));
  switch (table) {
    case 'device':
      // Проверить, если изменился тип - нужно изменить props, то есть полностью переписать
      if (doc.$set && doc.$set.type && doc.type != doc.$set.type) {
        // Получить новый props для типа - весь вложенный объект будет заменен
        doc.$set.props = typestore.createPropsFromType(doc.$set.type);
      }
      break;

    case 'scene':
      // Проверить, что устройства сценария существуют
      // Если нет - сохранить с ошибкой
      if (doc.$set && doc.$set.realdevs) {
        try {
          dm.datagetter.checkDevsExist(doc.$set.realdevs);
        } catch (e) {  
          doc.$set.errstr = (doc.$set.errstr || '')+' '+e.message;
          doc.$set.err = 1;
          doc.$set.blk = 1;
        }
      }
      break;

    case 'devhard':
      // Если меняют привязку, проверить, что предыдущая привязка удалена и удалить если есть
      if (doc.$set && doc.$set.did && doc.$set.prop) {
        // Приходит всегда парой did, prop
        await devhardutil.removeOldDevlinkBeforeUpdate(doc.$set.did, doc.$set.prop, dm);
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

    case 'restapihandlergroup':
      // Сохранить флаг useproject_frontend как флаг frontend в project.json
      if (doc.$set && doc.$set.useproject_frontend != undefined) {
        appconfig.setProjectProp('frontend', !!doc.$set.useproject_frontend);
      }
      break;

    default:
  }
}

async function findOrAddDoc({ collection, id }, dm) {
  const olddoc = await dm.dbstore.findOne(collection, { _id: id });
  if (olddoc) return olddoc;

  // const spec = ['devicedb', 'glcurrent', 'typealertrules'];
  const spec = ['devicedb', 'glcurrent', 'infogroupmembers'];
  if (spec.includes(collection)) {
    switch (collection) {
      case 'devicedb':
        await dm.dbstore.insert(collection, { _id: id, props: {} });
        return dm.dbstore.findOne(collection, { _id: id });
      default:
        await dm.dbstore.insert(collection, { _id: id });
        return dm.dbstore.findOne(collection, { _id: id });
    }
  }
  throw new Error('Not found doc: _id = ' + id + ', collection ' + collection);
}

async function saveTypepropalert(recToWrite, nodeid, holder) {
  // console.log('saveTypepropalert nodeid='+nodeid+' recToWrite='+util.inspect(recToWrite));
  /* recToWrite = { A1: { needAck: 1 }, A0: { delay: '5' } }
   */
  if (!recToWrite) throw { message: 'No recToWrite' };

  const [type, prop] = nodeid.split('.');
  const rec = await holder.dm.findRecordById('type', type);

  // prop.vtype из документа
  if (!rec) throw { message: 'Not found type=' + type };
  if (!rec.props || !rec.props[prop]) throw { message: 'Not found prop=' + prop + ' in type=' + type };
  if (!rec.props[prop].ale) return []; // Отключены тревоги для свойства
  const vtype = rec.props[prop].vtype;

  let pObj = rec.alerts && rec.alerts[prop] ? rec.alerts[prop] : '';

  const doc = { _id: type };
  if (!pObj || !domaindata.isSuitableAlerts(vtype, pObj)) {
    // Сформировать дефолтную запись и объединить с основной
    pObj = hut.merge(domaindata.getDefaultalerts(vtype), recToWrite);
    doc.$set = makeAlertSetObj(prop, pObj);
  } else {
    doc.$set = makeAlertSetObj(prop, recToWrite);
  }
  await holder.dm.updateDocs('type', [doc]);

  function makeAlertSetObj(mainprop, data) {
    let setObj;
    // mainprop = 'state', data = { LoLo:{ level:1 },Lo:{msg:'!!'}}
    // нужно вернуть "alerts.state.LoLo.level":1
    for (const aprop in data) {
      if (typeof data[aprop] == 'object') {
        for (const attr in data[aprop]) {
          if (!setObj) setObj = {};
          setObj['alerts.' + mainprop + '.' + aprop + '.' + attr] = data[aprop][attr];
        }
      }
    }
    return setObj;
  }
}

async function beforeRemove(table, doc, dm) {
  await checkDocCanBeRemoved(table, doc, dm);

  switch (table) {
    case 'units':
      // Если удаляется экземпляр или одиночный плагин - удалить его каналы
      await devhardutil.removeUnitChannels(doc._id, dm);
      break;

    /*
    case 'dbagent':
      // Удаляется dbagent - сбросить dbname
      appconfig.setProjectProp('dbname', '');
      break;
    */

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
      visInvalidateCache(table, doc._id, dm);
      break;

    case 'project':
      // Удалить всю папку проекта
      await projutil.removeProject(doc, dm);
      break;

    default:
  }
}

async function checkDocCanBeRemoved(table, doc, dm) {
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
      items = await getTemplateUsage(doc._id, dm);
      if (items.length)
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Шаблон используется, найдено элементов: ' + items.length
        };
      break;

    case 'snippet':
      items = await getSnippetUsage(doc._id, dm);
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
      items = await getDeviceVisLinksCount(doc._id, dm);
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

async function getDeviceVisLinksCount(id, dm) {
  // Число (счетчик) привязок к визуализации
  const items = await getDeviceVisUsage(id, dm);
  return items.reduce((count, item) => count + (item.content_str ? item.content_str.split(';').length : 0), 0);
}

async function getDeviceVisUsage(id, dm) {
  const table = 'devicevisTable';
  // dataFromTable, table, cNodeid, item, holder
  return virttables[table]([], table, id, '', { dm });
}

async function getTemplateUsage(id, dm) {
  const table = 'templateusageTable';
  return virttables[table]([], table, id, '', { dm });
}

// snippetusageTable
async function getSnippetUsage(id, dm) {
  const table = 'snippetusageTable';
  return virttables[table]([], table, id, '', { dm });
}

async function customValidate({ prop, doc, _id, table }, dm) {
  // console.log('WARN: customValidate START prop=' + prop + ' doc=' + util.inspect(doc) + ' id=' + _id);
  let res;
  switch (table) {
    case 'devhard':
      res = await devhardutil.customValidate({ prop, doc, _id }, dm);
      return res;

    case 'dbagent':
      res = await dbagentutil.customValidate({ prop, doc, _id }, dm);
      return res;

    case 'devicecommonTable':
      res = await deviceutil.customValidate({ prop, doc, _id }, dm);
      return res;

    case 'scene':
      res = await sceneutils.customValidate({ prop, doc, _id }, dm);
      return res;

    default:
  }
}

async function saveExField({ item, field, nodeid, value }, dm) {
  let retObj;
  let prevObj;
  switch (item.type) {
    case 'code':
    case 'script':
      if (field == 'handler') {
        retObj = await saveHandler(nodeid, value, dm);
      } else {
        retObj = await saveScript(nodeid, value, dm);
      }
      return retObj;

    case 'layout':
    case 'container':
    case 'dialog':
      await saveVisFile(item.type, nodeid, value);
      visInvalidateCache(item.type, nodeid, dm);
      break;

    case 'template':
      // Прежде чем сохранить, считать предыдущий файл шаблона - для дальнейшей обработки
      prevObj = await projectdata.getCachedProjectObj('template', nodeid, dm);
      await saveVisFile(item.type, nodeid, value);
      visInvalidateCache(item.type, nodeid, dm);
      await processContainersWithTemplate(nodeid, prevObj, value, dm);
      break;

    default:
  }
}

async function saveHandler(nodeid, value, dm) {
  // При сохранении проверить module.exports = function
  // retObj = await processHandlerStrBeforeSaveToFile(nodeid, value);
  if (!nodeid) return;

  if (nodeid.indexOf('.') > 0) {
    // обработчики для типов
    const [typeId, prop] = nodeid.split('.');
    const typeObj = typestore.getTypeObj(typeId);
    if (!typeObj) {
      throw { message: 'Not found type ' + typeId };
    }

    // Если обработчик не пользовательский - не сохраняем
    // Не получилось сделать disabled:"data.p1.fuse<2", работает только disabled:true/false
    if (!prop.startsWith('_On') && !prop.startsWith('_format')) {
      const fuse = typestore.getTypeObjPropField(typeId, prop, 'fuse');
      // console.log('typeobj='+util.inspect(typestore.getTypeObj(typeId)));
      if (fuse < 2) {
        throw {
          message: 'Для редактирования переключите тип обработчика на "Пользовательский" на вкладке "Свойства".'
        };
      }
    }
    const filename = appconfig.getHandlerFilename(nodeid);
    hut.unrequire(filename);
    await fileutil.writeFileP(filename, value);

    const result = handlerutil.checkHandler(typeObj, prop); // {toUpdate:{}, errstr}
    dm.emit('updated:typehandler', { typeId, prop, filename, errstr: result.errstr }); // Установить в typeObj, traceSet и на worker
    return result.toUpdate; // Для записи в таблицу

    // return handlerutil.checkHandler(typeObj, prop);
  }

  // if (nodeid.startsWith('api') || nodeid.startsWith('restapi')) {
  const filename =
    nodeid.startsWith('api') || nodeid.startsWith('restapi')
      ? appconfig.getRestapihandlerFilename(nodeid)
      : nodeid.startsWith('vs')
      ? appconfig.getVisScriptFilename(nodeid)
      : appconfig.getHandlerFilename(nodeid);
  hut.unrequire(filename);
  await fileutil.writeFileP(filename, value);
}

async function saveScript(nodeid, value, dm) {
  // sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw
  let res;
  let filename;
  let event;
  let table;
  if (nodeid.startsWith('snippet')) {
    table = 'snippet';
    filename = appconfig.getSnippetFilename(nodeid);
    event = 'saved:snippet';
  } else if (nodeid.startsWith('api')) {
    table = 'restapihandler';
    filename = appconfig.getRestapihandlerFilename(nodeid);
    event = 'saved:restapihandler';
  } else {
    table = 'scene';
    filename = appconfig.getScriptFilename(nodeid);
    const rec = await dm.findRecordById('scene', nodeid);
    const multi = rec && rec.multi ? 1 : 0;
    res = await sceneutils.processScriptFile(nodeid, { multi }, value);

    // Проверить устройства сценария??

    event = 'saved:script';
  }

  hut.unrequire(filename);
  await fileutil.writeFileP(filename, value);

  dm.emit(event, nodeid);
  return { table, doc: res };
}

function visFilename(folder, nodeid) {
  return path.resolve(appconfig.get('jbasepath'), folder, nodeid + '.json');
}

function visInvalidateCache(folder, nodeid, dm) {
  dm.invalidateCache({ type: 'pobj', id: folder, nodeid });
  dm.invalidateCache({ type: 'uppobj', id: folder, nodeid });
}

async function saveVisFile(type, nodeid, value) {
  const filename = visFilename(type, nodeid);
  await fileutil.writeFileP(filename, value); // stringify внутри
}

/**
 * Если в шаблоне есть удаленные переменные шаблона или actions - нужно удалить в контейнерах, которые исп шаблон
 * @param {String} templateId - id шаблона (имя файла)
 * @param {Object} prevObj - шаблон до редактирования
 * @param {Object} newObj  - шаблон после редактирования
 */
async function processContainersWithTemplate(templateId, prevObj, newObj, dm) {
  // Найти, где используется этот шаблон
  const usageArr = getTemplateUsage(templateId, dm); // [{container_id, template_id, element},...]
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
        visInvalidateCache('container', containerId, dm);
      }
    }
  }
}

// При редактировании таблицы - менять другие таблицы (smartbutton)
async function processTableSpecField({ nodeid, rowid, field, fieldItem }, dm) {
  if (field == 'devtrig') {
    return fieldItem && fieldItem.result && fieldItem.result.did && fieldItem.result.prop
      ? fieldItem.result.did + '.' + fieldItem.result.prop
      : '';
  }

  // smartbutton2 для dn_prop
  if (field == 'dn_prop') {
    // Привязка - приходит {id:"d0022", prop:'state', dn:'DN002', title:'DN002.value'} id-did устройства
    // Отвязка  - приходит {value:{}}??
    return fieldItem.dn && fieldItem.prop ? fieldItem.dn + '.' + fieldItem.prop : '-';
  }

  // smartbutton2 для id_prop
  if (field == 'id_prop' || field == 'cmd_prop') {
    // Привязка - приходит {id:"d0022", prop:'state', dn:'DN002', title:'DN002.value'} id-did устройства
    // Отвязка  - приходит {value:{}}??
    return fieldItem.id && fieldItem.prop ? fieldItem.id + '.' + fieldItem.prop : '-';
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

async function saveConfig(rec) {
  throw { error: 'Validation', message: 'Используйте кнопку "Перезагрузить" для применения настроек!' };
  /*
  const newObj = {};
  if (!rec) return;

  if (rec.port) newObj.port = rec.port;
  if (rec.apiport) newObj.apiport = rec.apiport;
  if (rec.lang) newObj.lang = rec.lang;
  if (rec.expert != undefined) newObj.expert = rec.expert;

  if (rec.otherprojdir != undefined) { // Переключили галочку
    if (!rec.otherprojdir) {
      // Восстановить default
      newObj.projdir ='';
    } else {
      newObj.projdir = rec.projdir;
    }
    // В любом случае при переключении галки сбросить проект, иначе он создается пустой с этим именем
    newObj.project ='';
  } 
  appconfig.saveConfigObject(newObj);
  */
}

// table currentprojectTable
async function saveCurrentProjectSettings(doc, nodeid, holder) {
  if (!doc) return;

  const _id = appconfig.get('project'); // Текущий проект
  if (doc.newmodule) {
    // Вкладка установки зависимостей
    // Здесь нужно установить модуль!!!
    await projutil.installDeps(_id, doc.newmodule);
    await projutil.updateCurrentProjectDeps(holder.dm); // Заново считать весь список зависимостей
    return;
  }
  // Сохранить в таблицу projects
  await holder.dm.updateDocs('project', [{ _id, $set: { ...doc } }]);

  // Сохранить в appconfig
  Object.keys(doc).forEach(prop => {
    appconfig.setProjectProp(prop, doc[prop]);
  });
}

async function importDocs({ format, param, data, nodeid }, holder) {
  if (importmethods[format] && importmethods[format][param]) {
    return importmethods[format][param]({ data, nodeid }, holder);
  }
}

async function subtreeAction({ id, navnodeid, payload }, holder) {
  if (id == 'channels') {
    const unit = navnodeid;
    if (payload.action == 'grouplink') return devhardutil.channelsLinkToDevice(unit, payload, holder); // ПРивязать каналы к устройству
    // if (payload.action == 'clone') return devhardutil.cloneChannels(unit, payload, holder); // Клонировать каналы
    throw { message: 'Unexpected dialog action for ' + id };
  }

  throw { message: 'No dialog actions for id = ' + id };
  /*
  {
    "type":"subtree",  
    "id": "channels",
    "method": "dialog",
    "navnodeid": "modbus1",
    "payload":{"folders":[{"nodeid": "wpn7ur8w7"}]} 
    }
 */
}

/*  Вызов формы в popup item
  {
            "id": "7",
            "type": "item",
            "title": "Клонировать",
            "command": "dialog",
            "param": {
              "variant": "form",
              "style":{"height":210, "width":450},
              "title": "Клонировать",

              "meta": {
                "grid": [{ "id": "p1", "xs": 12, "class": "main" }],
                "spacing": 8,
                "p1": [{ "prop": "unitId", "title": "UnitId", "type": "input" }]
              },
              "data": {
                "p1": { "unitId": "" }
              }
            }
          },
          */

module.exports = {
  createOneRecord,
  copypasteDoc,
  cloneDoc,
  findOrAddDoc,
  beforeUpdate,
  beforeRemove,
  customValidate,
  saveExField,
  processTableSpecField,
  saveConfig,
  importDocs,
  subtreeAction,
  saveTypepropalert,
  saveCurrentProjectSettings
};
