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

const typestore = require('../device/typestore');
const handlerutils = require('../device/handlerutil');
const sceneutils = require('../scene/sceneutils');

const datagetter = require('./datagetter');
const virttables = require('./virttables');
const projectdata = require('./projectdata');

async function createNewDocsFromTree(nodes, table, parentid) {
  if (!nodes || !table) return [];

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
      const doc = await createOneRecord(table, tdesc.filter, item, parentid);
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

  // ЗДЕСЬ можно делать разные вещи для таблиц
  switch (table) {
    case 'device':
      return typestore.createDeviceDoc(doc, item.popupid);

    case 'devhard':
      return createDevhardDoc(doc, item, body);

    case 'scene':
      doc.status = 0;
      doc.name = 'New script';
      // Копировать шаблонный скрипт
      await sceneutils.createNewScriptFromTemplate(doc._id);
      return doc;

    case 'handler':
      // Создать переменные заголовка
      const headerObj = handlerutils.getNewScriptHeader(item.popupid);

      // Их записать в doc - name, type, desc и передать для создания скрипта
      Object.assign(doc, headerObj);
      // Копировать шаблонный скрипт в зависимости от типа
      await handlerutils.createNewScriptFromTemplate(doc._id, headerObj);

      return doc;

    case 'scenecall':
      doc.sid = parentid;

      Object.keys(item).forEach(prop => {
        // При добавлении новой строки, если droplist не был выбран, передается {id: "-", title: "-"}
        // Предварительную проверку этого выполняет validator.preValidateTable
        if (item[prop] && typeof item[prop] != 'object') doc[prop] = item[prop];
      });

      return doc;

    case 'unitextTable':
      doc.unit = parentid;
      return { ...doc, ...item };

    default:
      return doc;
  }
}

/**  Сформировать запись для канала
 *   Варианты: 1. Из subtree каналов
 *                item.navnodeid - основное дерево - unit
 *             2. Новый канал при привязке из формы
 *                 в item пришли данные в том числе для привязки { did: 'd0518', prop: 'value' }
 */
async function createDevhardDoc(doc, item, body) {
  console.log(
    'createDevhardDoc doc=' + util.inspect(doc) + ' item=' + util.inspect(item) + ' body=' + util.inspect(body)
  );

  if (item.navnodeid) {
    // Формируется из дерева каналов
    doc.unit = item.navnodeid;
  } else if (item.unit) {
    doc.unit = item.unit;
  } else {
    doc.unit = getUnitFromFormId();
  }

  if (item.folder) {
    doc.folder = 1;
    doc.chan = 'New Folder';
  } else {
    // Default для канала взять от плагина, если новая запись для get? Если update - встанет поверх дефолтного значения
    const defchan = await dm.getManifestItem(doc.unit, 'chdefault');
    Object.assign(doc, defchan, item);

    // Генерировать уникальное ID канала:
    if (!doc.chan || (await isChanNotUnique(doc, ''))) {
      // Проверить уникальность. Если не уникально - генерировать уникальный
      const rule = await dm.getManifestItem(doc.unit, 'ruleId');
      doc.chan = await getNewChan(doc.unit, rule);
    }

    // Если добавляется вместе с привязкой, то нужно удалить старую привязку устройства
    if (doc.did) await removeOldDevlinkBeforeUpdate(doc.did, doc.prop);
  }
  return doc;

  function getUnitFromFormId() {
    // body = {id:'channellink.modbus1'}
    if (!body || typeof body != 'object') throw { err: 'SOFTERR', message: 'datamaker: Expected body parameter!' };
    if (!body.id) throw { err: 'SOFTERR', message: 'datamaker: Expected body.id parameter!' };
    let unit;
    if (body.id.indexOf('.') > 1) {
      unit = body.id.split('.').pop();
    } else if (body.rowid.indexOf('.') > 1) {
      unit = body.rowid.split('.').pop();
    }

    if (!unit) throw { err: 'SOFTERR', message: 'datamaker: Failed to define unit from id!' };

    return unit;
  }
}

async function getNewChan(unit, rule) {
  if (!rule || !rule.len) rule = { pref: 'ch', len: 3 };
  // const regexp = new RegExp('^' + rule.pref + '\\d{' + String(rule.len - 1) + ',' + String(rule.len + 2) + '}$');
  // Выбираем только заданной длины ??? И полагаемся на сортировку
  // TODO После полного заполнения работать не будет!  ch999 -> ch1000
  const regexp = new RegExp('^' + rule.pref + '\\d{' + String(rule.len) + ',' + String(rule.len) + '}$');
  const docs = await dm.dbstore.get('devhard', { unit, chan: regexp }, { order: 'chan', fields: { unit: 1, chan: 1 } });

  const res = rule.pref + getNextNum();
  return res;

  function getNextNum() {
    const num = !docs.length ? 1 : Number(hut.extractNumFromStr(docs[docs.length - 1].chan)) + 1;
    return String(num).padStart(rule.len, '0');
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

    case 'handler':
      doc.status = 0;
      doc.name += ' (copy)';
      // Копировать файл скрипта - просто переписать
      await fileutil.copyFileP(appconfig.getHandlerFilename(oldId), appconfig.getHandlerFilename(doc._id));
      break;

    case 'layout':
    case 'container':
    case 'template':
      doc.status = 0;
      doc.name += ' (copy)';

      // Копировать файл с контентом
      await fileutil.copyFileP(visFilename(table, oldId), visFilename(table, doc._id));
      break;

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

    case 'devicedbTable':
      // console.log('devicedbTable BEFORE UPDATE doc=' + util.inspect(doc));
      // По измененным свойствам - добавить или убрать атрибуты $set, $unset? в doc
      processDevicedbBeforeUpdate(doc);
      // console.log('devicedbTable AFTER UPDATE doc=' + util.inspect(doc));
      break;

    case 'devhard':
      // Если меняют привязку, проверить, что предыдущая привязка удалена и удалить если есть
      if (doc.$set && doc.$set.did && doc.$set.prop) {
        // Приходит всегда парой did, prop
        await removeOldDevlinkBeforeUpdate(doc.$set.did, doc.$set.prop);
      }
      break;

    default:
  }
}

async function removeOldDevlinkBeforeUpdate(did, prop) {
  // Найти каналы с такой привязкой и удалить
  const docs = await dm.dbstore.get('devhard', { did, prop }, { fields: { did: 1, prop: 1 } });

  if (docs.length > 0) {
    const updatedDocs = await dm.dbstore.updateAndReturnUpdatedDocs(
      'devhard',
      { did, prop },
      { $set: { did: '', prop: '' } }
    );
  }
}

function processDevicedbBeforeUpdate(doc) {
  /** doc={
    _id: 'd0800',
    props: {
      value: { db: 1, dbmet: 2, dbcalc_type: 'last', dbforce: '2' },
      state: { dbmet: 0, dbcalc_type: 'average' },
      setpoint: { dbmet: 3, dbcalc_type: 'last' }
    },
  
    '$set': {
      'props.value.dbmet': 1,
      'props.value.dbcalc_type': 'minmax',
      'props.state.dbmet': 2,
      'props.setpoint.dbtm': '30'
    },
    '$unset': undefined - на входе не будет никогда, т к удалять строки нельзя
  }
  */

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
    case 'images':
      // Удалить файл картинки

      break;

    case 'scene':
      // Удалить файл скрипта
      sceneutils.removeScriptFile(doc._id);
      break;

    case 'handler':
      handlerutils.unrequireHandler(doc._id);
      // Удалить файл скрипта
      fileutil.delFileSync(appconfig.getHandlerFilename(doc._id));
      break;

    case 'layout':
    case 'container':
    case 'template':
      // Удалить файлы контента
      fileutil.delFileSync(visFilename(table, doc._id));
      // Сбросить кэш
      visInvalidateCache(table, doc._id);
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

    case 'handler':
      items = datagetter.getTypePropsWithFname(doc._id);
      if (items.length) {
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Обработчик используется в типах. Найдено привязок: ' + items.length
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

    case 'device':
      // Если есть привязки к визуализации
      items = await getDeviceVisUsage(doc._id);
      if (items.length)
        throw {
          err: 'ERR',
          message: 'Удаление не выполнено! Устройство используется в визуализации, найдено ссылок: ' + items.length
        };
        
      // TODO - или к сценариям

      break;
    default:
  }
}

async function getDeviceVisUsage(id) {
  const table = 'devicevisTable';
  return virttables[table]([], table, id);
}

async function getTemplateUsage(id) {
  const table = 'templateusageTable';
  return virttables[table]([], table, id);
}

async function customValidate({ prop, doc, _id, table }) {
  console.log('customValidate START prop=' + prop + ' table=' + table + ' id=' + _id);
  let res;
  switch (table) {
    case 'devhard':
      if (prop == 'chan') {
        res = await isChanNotUnique(doc, _id);
        if (res) return 'mustBeUnique';
      }
      break;

    default:
  }
}

// Канал д б уникален для плагина
async function isChanNotUnique(doc, _id) {
  console.log('isChanNotUnique id=' + _id + ' doc=' + util.inspect(doc));
  const chan = doc.chan;
  if (!chan) return;

  let unit = doc.unit;
  if (!unit && _id) {
    // Меняют канал - unit нужно взять из записи
    const rec = await dm.dbstore.findOne('devhard', { _id });
    // Если не нашли запись??
    if (!rec) return;
    unit = rec.unit;
  }
  if (!unit) return;

  const data = await dm.dbstore.get('devhard', { unit, chan }, { fields: { unit: 1, chan: 1 } });
  console.log('data.length=' + data.length);

  if (data.length > 1) return true;
  // Если запись есть - то id записи должно совпадать!
  if (data.length == 1 && _id != data[0]._id) return true;
}

async function saveExField(exFieldItem, field, nodeid, value) {
  let filename;
  let retObj;
  let prevObj;
  switch (exFieldItem.type) {
    case 'code':
      if (field == 'handler') {
        // При сохранении изменить name, type в таблице handlers
        retObj = await processHandlerStrBeforeSaveToFile(nodeid, value);
        filename = appconfig.getHandlerFilename(nodeid);
        hut.unrequire(filename);
        await fileutil.writeFileP(filename, value);
        typestore.reloadHandler(nodeid);
      } else {
        sceneutils.processScriptStr(value); // Это валидация. Если будет ошибка - throw
        filename = appconfig.getScriptFilename(nodeid);
        hut.unrequire(filename);
        await fileutil.writeFileP(filename, value);
      }

      break;

    case 'layout':
    case 'container':
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

async function processHandlerStrBeforeSaveToFile(_id, str) {
  // При сохранении изменить name, type в таблице handlers
  const olddoc = await dm.dbstore.findOne('handlers', { _id });
  if (olddoc) {
    const res = handlerutils.verifyDoc(_id, str, olddoc);
    return res && res.doc && res.doc.$set ? { table: 'handler', doc: res.doc.$set } : '';
  }

  // Создать новый документ - пришли не через редактирование?
  const newdoc = handlerutils.createNewDoc(_id, str);
  await dm.dbstore.insert('handlers', newdoc);
}

// При редактировании таблицы - менять другие таблицы (smartbutton)
async function processTableSpecField(nodeid, rowid, field, fieldItem) {
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
