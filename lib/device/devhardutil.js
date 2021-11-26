/**
 * devhardutil.js
 */

const util = require('util');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const numerator = require('../dbs/numerator');

/**  Сформировать запись для канала
 *   Варианты: 1. Из subtree каналов
 *                item.navnodeid - основное дерево - unit
 *             2. Новый канал при привязке из формы
 *                 в item пришли данные в том числе для привязки { did: 'd0518', prop: 'value' }
 */
async function createDevhardDoc(doc, item, body, dm) {
  if (item.navnodeid) {
    // Формируется из дерева каналов
    doc.unit = item.navnodeid;
  } else if (item.unit) {
    doc.unit = item.unit;
  } else {
    doc.unit = getUnitFromFormId();
  }
  const defchan = await getDefaultChannel(doc.unit);

  // console.log('createDevhardDoc defchan='+util.inspect(defchan))
  if (item.folder) {
    doc.folder = 1;
    doc.chan = appconfig.getMessage('NewFolder');
    Object.assign(doc, defchan);
  } else {
    Object.assign(doc, defchan);
    if (item.did && item.prop) {
      doc.did = item.did;
      doc.prop = item.prop;
    }

    // Проверить уникальность. Если нет или не уникально - генерировать уникальный
    if (!doc.chan || (await isChanNotUnique(doc, '', dm))) {
      doc.chan = await getNewChan(doc.unit, doc.chan, dm);
    }

    // Если добавляется вместе с привязкой, то нужно удалить старую привязку устройства
    if (doc.did) await removeOldDevlinkBeforeUpdate(doc.did, doc.prop, dm);
  }
  return doc;

  async function getDefaultChannel(unit) {
    const popupItems = [
      'channel_folder',
      'channel_node_folder',
      'channel_hub_folder',
      'channel',
      'channel_read',
      'channel_write'
    ];
    const manifest = await dm.getManifest(unit, true);

    if (item.popupid && popupItems.includes(item.popupid)) {
      const manProp = 'default_' + item.popupid;
      return manifest[manProp] || manifest.chdefault || '';
    }
    return '';
  }

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

/*
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
*/

async function getNewChan(unit, chan, dm) {
  let pref = hut.removeLastNumFromStr(chan); // Без последних цифр
  if (parseInt(pref, 10) == pref) pref = ''; // Число числовые каналы
  // const regexp = new RegExp('^' + rule.pref + '\\d{' + String(rule.len - 1) + ',' + String(rule.len + 2) + '}$');
  const regexp = new RegExp('^' + pref + '\\d{0,12}$');
  // console.log('WARN: regexp '+regexp);
  // На  order: 'chan' не надеюсь, т к chan_1, chan_10, chan_22
  // const docs = await dm.dbstore.get('devhard', { unit, chan: regexp }, { order: 'chan', fields: { unit: 1, chan: 1 } });
  const docs = await dm.dbstore.get('devhard', { unit, chan: regexp }, { fields: { unit: 1, chan: 1 } });
  if (docs.length) {
    const nums = docs.map(doc => parseInt(hut.extractNumFromStr(doc.chan), 10)).sort((a, b) => a - b);
    return pref + String(nums[nums.length - 1] + 1);
  }

  return chan || 'ch_1';
}

async function cloneDevhardDoc(doc, body, dm) {
  const unitId = body.input;
  doc.did = '';
  doc.prop = '';
  if (doc.folder) {
    // Сформировать имя папки - это тоже chan, так как рассчитываем на групповые каналы тоже???
    // doc.chan += ' ' + unitId; // Дописать вместо последнего слова
    doc.chan = hut.replaceLastWord(doc.chan, unitId);
  } else {
    doc.unitid = unitId;
    // doc.chan += '_' + unitId; // Наоборот - заменить впереди
    doc.chan = hut.replaceBeforeChar(doc.chan, unitId, '_');
  }

  // Если уже есть - добавить для уникальности ts
  if (await isChanNotUnique(doc, '', dm)) {
    doc.chan += '_' + Date.now();
  }
}

// Канал д б уникален для плагина
async function isChanNotUnique(doc, _id, dm) {
  // console.log('isChanNotUnique id=' + _id + ' doc=' + util.inspect(doc));
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
  // console.log('data.length=' + data.length);

  if (data.length > 1) return true;
  // Если запись есть - то id записи должно совпадать!
  if (data.length == 1 && _id != data[0]._id) return true;
}

async function customValidate({ prop, doc, _id }, dm) {
  if (prop == 'chan') {
    const res = await isChanNotUnique(doc, _id, dm);
    if (res) return 'mustBeUnique';
  }
  const val = doc[prop];
  if (prop == 'calc' && val) return tryMakeFun(val);
  if (prop == 'calc_out' && val) return tryMakeFun(val);
}

function tryMakeFun(calc) {
  try {
    const fn = new Function('value', 'return ' + calc);
  } catch (e) {
    return 'ERROR: ' + calc + ': ' + hut.getShortErrStr(e);
  }
}

async function removeOldDevlinkBeforeUpdate(did, prop, dm) {
  // Найти каналы с такой привязкой и удалить
  const docs = await dm.dbstore.get('devhard', { did, prop }, { fields: { did: 1, prop: 1 } });

  if (docs.length > 0) {
    await dm.dbstore.updateAndReturnUpdatedDocs('devhard', { did, prop }, { $set: { did: '', prop: '' } });
  }
}

async function removeUnitChannels(unit, dm) {
  // Найти каналы для unit и удалить
  const txt = 'removeUnitChannels for unit ' + unit;
  try {
    const numRemoved = await dm.dbstore.remove('devhard', { unit }, { multi: true });
    console.log('WARN: ' + txt + '. Removed records: ' + numRemoved);
  } catch (e) {
    // Перехватить ошибку, что нет удаленных записей  Другие ошибки вывести в лог
    if (e.error != 'ERRREMOVE') console.log('Error: ' + txt + util.inspect(e));
  }

  // TODO - если есть каналы в channel - удалить файл
}

/**
 * Привязка каналов к свойствам устройства
 *
 * @param {String} unit - id экземпляра плагина (modbus1)
 * @param {Object} payload:{
 *                      action:'grouplink',
 *                      dialogresult:{ id:'d0019'}
 * @param {Object} holder
 */
async function channelsLinkToDevice(unit, payload, holder) {
  // Привязка каналов к свойствам устройства - д б свойство
  if (!payload.dialogresult || !payload.dialogresult || !payload.dialogresult.id)
    throw { message: 'Missing payload.dialogresult.id!' };

  const dm = holder.dm;
  const nodeid = payload.nodeid; // id записи папки в каналами в devhard
  const did = payload.dialogresult.id; // Устройство
  const dobj = holder.devSet[did];
  if (!dobj) throw { message: 'Устройство не найдено: ' + did };

  // Выбрать свойства устройства для привязки - взять только не привязанные
  const propArr = dobj.getPropsForHardlink(); // массив свойств
  const linkObj = await getDeviceHardLinks(did, dm); // существующие привязки
  const freePropArr = propArr.filter(prop => !linkObj[prop]);
  if (!freePropArr.length) throw { message: 'Все свойства устройства ' + dobj.dn + ' уже привязаны!' };

  // Выбрать каналы из папки nodeid - 1 уровень вложенности пока!

  const folderDocs = await dm.get('devhard', { parent: nodeid });
  if (!folderDocs || !folderDocs.length) throw { message: 'В папке нет каналов!' };

  //  - каналы берем НЕ привязанные с атрибутом devpropname
  const channelDocs = folderDocs.filter(doc => doc.devpropname && !doc.did);

  if (!channelDocs.length) throw { message: 'Каналы уже привязаны или не заполнено имя свойства для привязки!' };

  // Идем по каналам и подбираем свойства устройства по имени devpropname
  const upDocs = [];
  channelDocs.forEach(doc => {
    const idx = freePropArr.indexOf(doc.devpropname);
    if (idx >= 0) {
      doc.$set = { did, prop: doc.devpropname };

      upDocs.push(doc);
      freePropArr.splice(idx, 1);
    }
  });

  // Формируем массив изменений

  if (upDocs.length) {
    await dm.updateDocs('devhard', upDocs);
  } else {
    throw { message: 'Каналы уже привязаны или нет свойств, подходящих для устройства!' };
  }
}

// Найти существующие привязки этого устройства
async function getDeviceHardLinks(did, dm) {
  const linkObj = {};
  const devhardDocs = await dm.dbstore.get('devhard', { did });
  // Привязок может не быть, это нормально.
  if (devhardDocs && devhardDocs.length) {
    devhardDocs.forEach(doc => {
      linkObj[doc.prop] = doc.unit + '.' + doc.chan;
    });
  }
  return linkObj;
}

/**
 * Добавление новых каналов в таблицу каналов (при сканировании)
 *  - добавляются только каналы, не папки
 *  04.11.21 - НЕТ, плагин может отдать описание папки в каждом канале - (zigbee - папка это устройство)
 *             Тогда нужно генерировать папки при отсутствии
 *
 * @param {Array of Objects} docs - запись содержит все атрибуты канала
 *                                  (плагин должен сформировать канал)
 * @param {String} unit - экземпляр плагина ('mqttclient1')
 * @param {String} nodeid - папка в devhard, куда будут вставлены каналы (опционально)
 * @param {Object} dm
 *
 * @throw
 *     - если не передан unit или docs
 *     - при ошибке функции insertDocs (не удалось записать в хранилище)
 */
async function addDevhardDocs(docs, unit, nodeid, dm) {
  console.log('addDevhardDocs START docs=' + util.inspect(docs));

  if (!unit) throw { message: 'Expected unit!' };
  if (!docs || !Array.isArray(docs)) throw { message: 'Expected array of channels!' };
  if (!docs.length) return;

  if (docs[0].chan && docs[0].parentfolder) return addDevhardDocsWithFixChan(docs, unit, nodeid, dm);
  if (unit == 'applehomekit') return addDevhardDocsWithHierarchicalFolders(docs, unit, nodeid, dm);

  // Добавляем в конец. Чтобы рассчитать order - считать элементы внутри parent и вычислить max order
  const folderDocs = await dm.get('devhard', { parent: nodeid }, { order: 'order' });
  let order =
    folderDocs && folderDocs.length && folderDocs[folderDocs.length - 1].order > 0
      ? folderDocs[folderDocs.length - 1].order
      : 100;

  for (let doc of docs) {
    doc._id = numerator.getNewId();
    order += 100;
    doc.order = order;
    doc.unit = unit;
    doc.parent = nodeid || '';
    if (!doc.r && !doc.w) doc.r = 1; // по умолчанию для чтения

    // Проверить уникальность. Если нет или не уникально - генерировать уникальный
    if (!doc.chan || (await isChanNotUnique(doc, '', dm))) {
      doc.chan = await getNewChan(doc.unit, doc.chan, dm);
    }
  }
  await dm.insertDocs('devhard', docs);

  return {
    data: docs.map(doc => ({
      id: doc._id,
      title: doc.chan,
      order: doc.order,
      component: 'channelview.' + unit
    }))
  };
}

/**
 * Добавление каналов для плагинов в фиксированными каналами
 *  - если канал уже есть - второй раз не добавляется? или перезаписывается?
 *
 * @param {*} indocs
 * @param {*} unit
 * @param {*} nodeid
 * @param {*} dm
 */
async function addDevhardDocsWithFixChan(indocs, unit, nodeid, dm) {
  function addTreeItemParent(id, title) {
    treeItems[id] = { id, title, children: [], component: 'channelfolder.' + unit, parent: root };
  }

  function addTreeItemChild(id, title, parent) {
    const node = { id, title, component: 'channelview.' + unit, parent };
    if (treeItems[parent]) {
      treeItems[parent].children.push(node);
    } else treeItems[id] = node;
  }

  // Одну папку создать только один раз.
  // При этом один канал можно добавлять много раз - чтобы привязать к разным устройствам?
  const newFolderMap = new Map();

  const root = unit + '_all';
  const docs = [];
  const treeItems = {};
  let refresh = false;
  for (let doc of indocs) {
    let parent;
    const { parentfolder, ...leafObj } = doc;
    // Проверить папку, если нет -  создать
    if (parentfolder && parentfolder.id) {
      if (newFolderMap.has(parentfolder.id)) {
        parent = newFolderMap.get(parentfolder.id);
      } else {
        let pfolderRec = await dm.findOne('devhard', { chan: parentfolder.id });
        if (!pfolderRec) {
          pfolderRec = {
            ...parentfolder,
            unit,
            folder: 1,
            _id: numerator.getNewId(),
            chan: parentfolder.id,
            parent: root
          };
          docs.push(pfolderRec);
          newFolderMap.set(parentfolder.id, pfolderRec._id);
          addTreeItemParent(pfolderRec._id, pfolderRec.title);
        }
        parent = pfolderRec._id;
      }
    }

    // Проверить канал, если нет -  создать
    let rec = await dm.findOne('devhard', { chan: doc.chan });

    if (!rec) {
      rec = { ...leafObj, unit, _id: numerator.getNewId(), chan: doc.chan, parent };
      if (!rec.r && !rec.w) rec.r = 1; // по умолчанию для чтения
      docs.push(rec);
      addTreeItemChild(rec._id, rec.title, parent);
    } else if (rec.missing) {
      // Если есть - проверить флаг missing!!  Восстановить
      await dm.dbstore.update('devhard', { _id: rec._id }, { $set: { missing: 0 } });
      refresh = true;
    }
  }

  if (docs.length) {
    await dm.insertDocs('devhard', docs);

    return {
      data: Object.keys(treeItems).map(id => treeItems[id]),
      refresh: true
    };
  }
  return { refresh };
}

// Добавить каналы, разворачивая в папки (многоэтажное дерево - для applehomekit)
async function addDevhardDocsWithHierarchicalFolders(indocs, unit, nodeid, dm) {
  function createFolder(chan, title, parent) {
    return {
      unit,
      folder: 1,
      _id: numerator.getNewId(),
      chan,
      parent,
      title
    };
  }

  function createChannel(chan, title, parent) {
    return {
      unit,
      _id: numerator.getNewId(),
      chan,
      parent,
      title,
      r: 1
    };
  }

  function processOne(parts, titles) {
    let chan = '';
    let parent = root;

    parts.forEach((part, idx) => {
      chan = chan ? chan + '/' + part : part;

      const lastPart = idx == parts.length - 1;

      if (chObj[chan]) {
        parent = chObj[chan]._id;
      } else {
        let newDoc;
        if (lastPart) {
          newDoc = createChannel(chan, titles[idx], parent);
        } else {
          newDoc = createFolder(chan, titles[idx], parent);
        }
        parent = newDoc._id;
        docs.push(newDoc);
      }
    });
  }

  const docs = [];

  // Взять все, вкл папки. Вывернуть по chan
  const existsDocs = await dm.get('devhard', { unit });
  const chObj = hut.arrayToObject(existsDocs, 'chan');

  const root = unit + '_all';

  indocs.forEach(indoc => {
    // Разбить
    // Если папок нет - формировать папки
    // Если есть - ничего не делать
    if (indoc.topic && indoc.chan) {
      const titles = indoc.topic.split('/');
      const parts = indoc.chan.split('/');
      if (titles.length == parts.length) {
        processOne(parts, titles);
      }
    }
  });

  if (docs.length) {
    await dm.insertDocs('devhard', docs);
    return { refresh: true };
  }
}

module.exports = {
  createDevhardDoc,
  cloneDevhardDoc,
  removeOldDevlinkBeforeUpdate,
  removeUnitChannels,
  customValidate,
  channelsLinkToDevice,
  getDeviceHardLinks,
  addDevhardDocs
};
