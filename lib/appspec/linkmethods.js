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
    case 'elementlink':
      return getDevicelink(query, dm, holder);

    case 'channellink':
      return getChannellink(query, dm, holder);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}

// Формирует массив свойств одного устройства для привязок
// Для привязки к каналу - если задан anchor
// Для привязки на визуализации - если не задан anchor
async function getDevicelink({ nodeid, anchor }, dm, holder) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  if (!holder.devSet[nodeid]) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

  if (!anchor || anchor == 'undefined') anchor = '';
  const dobj = holder.devSet[nodeid];
  const did = nodeid;
  // const dn = dobj.dn;
  // const name = dobj.name;

  const properties = anchor ? await forHardlink() : dobj.getPropsForVislink().map(prop => getItem(prop));
  return { data: { properties } };

  function getItem(prop, hard) {
    // const title = dn + ' ▪︎ ' + name + ' ▪︎ ' + prop;
    const title = datagetter.getDeviceTitle(did) + ' ▪︎ ' + prop;
    return {
      prop,
      title,
      link: '',
      enable: true,
      result: hard ? { did, prop, title, value: { did, prop }, anchor } : { did, prop, title, value: { did, prop } }
    };
  }

  async function forHardlink() {
    // типовые свойства, calc не берем
    const res = dobj.getPropsForHardlink().map(prop => getItem(prop, true));

    // Найти существующие привязки этого устройства
    const linkObj = {};
    const devhardDocs = await dm.dbstore.get('devhard', { did });
    // Привязок может не быть, это нормально.
    if (devhardDocs && devhardDocs.length) {
      devhardDocs.forEach(doc => {
        linkObj[doc.prop] = doc.unit + '.' + doc.chan;
      });
    }

    res.forEach(item => {
      if (linkObj[item.prop]) {
        item.link = linkObj[item.prop];
        item.enable = false;
      }
    });
    return res;
  }
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
  /*
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
  */

  docs.forEach(doc => {
    if (!doc.folder) {
      const prop = doc.unit + '.' + doc.chan;
      const link = doc.did ? datagetter.getDeviceTitle(doc.did) + '.' + doc.prop : '';
      // const formreq = !link ? { id: 'channellink.' + doc.unit, nodeid: anchor, rowid: doc._id } : null;

      properties.push({
        id: doc._id, // id записи в devhard
        prop, // Это д б канал для показа?
        title: prop,
        link, // Существующая привязка к устройству?
        enable: !link
      });
    }
  });
  return { data: { properties } };
}

module.exports = {
  get
};


// /api/admin?method=getmeta&type=tree&id=elements
// /api/admin?method=get&type=link&id=elementlink&nodeid=d0002

// По подписке
// {"uuid":"container_1","data":{"template_1":{"state1":1},"rectangle_1":{"d0015":{"state":1}}},"response":1}