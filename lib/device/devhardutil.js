/**
 * devhardutil.js
 */

const util = require('util');

const hut = require('../utils/hut');
const dm = require('../datamanager');

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

async function customValidate({ prop, doc, _id }) {
  if (prop == 'chan') {
    const res = await isChanNotUnique(doc, _id);
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

async function removeOldDevlinkBeforeUpdate(did, prop) {
  // Найти каналы с такой привязкой и удалить
  const docs = await dm.dbstore.get('devhard', { did, prop }, { fields: { did: 1, prop: 1 } });

  if (docs.length > 0) {
    await dm.dbstore.updateAndReturnUpdatedDocs('devhard', { did, prop }, { $set: { did: '', prop: '' } });
  }
}

async function removeUnitChannels(unit) {
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

module.exports = {
  createDevhardDoc,
  removeOldDevlinkBeforeUpdate,
  removeUnitChannels,
  customValidate
};
