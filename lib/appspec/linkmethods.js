/**
 * linkmethods.js
 *  Экспортирует таблицу функций для type:link
 */

// const util = require('util');

// const dm = require('../datamanager');
const datagetter = require('./datagetter');

/**
 * Возвращает данные по привязкам
 *
 * @param {Object} query - объект запроса
 * @return {Object}
 *
 */
async function get(query, dm, holder) {
  switch (query.id) {
    case 'devicelink':
      return getDevicelink(query, dm, holder);
    case 'channellink':
      return getChannellink(query, dm, holder);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}

// async function getDevicelink({ nodeid, anchor }, dm, holder) {
async function getDevicelink({ nodeid, anchor }, dm, holder) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };

  // Найти устройство: nodeid = devices._id
  const deviceDoc = await dm.dbstore.findOne('devices', { _id: nodeid });
  if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

  const withLink = anchor && anchor != 'undefined';

  if (withLink) {
    // Найти привязки этого устройства: nodeid = devhard.did
    const devhardDocs = await dm.dbstore.get('devhard', { did: nodeid });
    // Привязок может не быть, это нормально. Если есть - включим их в prop устройства
    if (devhardDocs && devhardDocs.length) {
      devhardDocs.forEach(doc => {
        const prop = doc.prop;
        if (deviceDoc.props[prop] && doc.unit) {
          deviceDoc.props[prop].link = doc.unit + '.' + doc.chan;
        }
      });
    }
  }

  // Сформировать результат
  // НО НУЖНО ФИЛЬТРОВАТЬ СВОЙСТВА
  // Если запрос для привязки к каналу - то показать свойства не calc и не error
  // Если для визуализации - не нужно включать cmd!
  // Отдельный запрос - наоборот, только команды (плюс set для записи свойства)?
  const dn = deviceDoc.dn;
  const name = deviceDoc.name;
  const properties = [];
  for (const prop in deviceDoc.props) {
    const link = deviceDoc.props[prop].link;
    const title = dn + ' ▪︎ ' + name + ' ▪︎ ' + prop;

    properties.push({
      dn,
      prop,
      name,
      title,
      link: link || '',
      enable: !withLink || !link,
      result: withLink
        ? { did: deviceDoc._id, dn, name, prop, title, value: { did: nodeid, prop }, anchor }
        : { did: deviceDoc._id, dn, name, prop, title, value: { did: nodeid, prop } }
    });
  }

  if (!withLink) {
    // Для визуализации
    const prop = 'error';
    const title = dn + ' ▪︎ ' + name + ' ▪︎ ' + prop;

    properties.push({
      dn,
      prop,
      name,
      title,
      link: '',
      enable: true,
      result: { did: deviceDoc._id, dn, name, prop, title, value: { did: nodeid, prop } }
    });
  }
  return { data: { properties } };
}

// async function getChannellink({ nodeid, anchor }, dm, holder) {
async function getChannellink({ nodeid, anchor }, dm) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  if (!anchor) throw { error: 'SOFTERR', message: 'Expected "anchor"!' };

  // Найти просто список каналов данного плагина
  const unit = nodeid;
  const docs = await dm.dbstore.get('devhard', { unit });

  // Сформировать результат, anchor нужен обязательно для формирования новой привязки!!

  const properties = [];

  // Первый пункт - новый канал, если плагин позволяет добавление нового канала вручную
  // Если в манифесте есть chdefault - добавить
  const chdefault = await dm.getManifestItem(unit, 'chdefault');
  if (chdefault) {
    properties.push({
      id: '__new.' + unit,
      prop: nodeid + ' Создать новый канал',
      title: nodeid + ' Создать новый канал',
      link: '',
      enable: true,
      formreq: { id: 'channellink.' + nodeid, nodeid: anchor, rowid: '__new.' + unit }
    });
  }

  docs.forEach(doc => {
    if (!doc.folder) {
      const prop = doc.unit + '.' + doc.chan;
      const link = doc.did ? datagetter.getDeviceTitle(doc.did) + '.' + doc.prop : '';
      const formreq = !link ? { id: 'channellink.' + doc.unit, nodeid: anchor, rowid: doc._id } : null;

      properties.push({
        id: doc._id, // id записи в devhard
        prop, // Это д б канал для показа?
        title: prop,
        link, // Существующая привязка к устройству?
        enable: !link,
        formreq
      });
    }
  });
  return { data: { properties } };
}

module.exports = {
  get
};
