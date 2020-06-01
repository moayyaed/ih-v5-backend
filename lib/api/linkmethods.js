/**
 * linkmethods.js
 * Функции отработки запросов для type:link
 * method:get
 * method:set
 * method:clear
 */

// const util = require('util');

const dm = require('../datamanager');
const datautil = require('./datautil');

/**
 * Возвращает данные по привязкам
 *
 * @param {Object} query - объект запроса
 * @return {Object}
 *
 */
async function get(query) {
  switch (query.id) {
    case 'devicelink':
      return getDevicelink(query);
    case 'channellink':
      return getChannellink(query);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}

async function getDevicelink({ nodeid, anchor }) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  if (!anchor) throw { error: 'SOFTERR', message: 'Expected "anchor"!' };

  // Найти устройство: nodeid = devices._id
  const deviceDoc = await dm.dbstore.findOne('devices', { _id: nodeid });
  if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

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

  // Сформировать результат, anchor используется для selected=true/false  и для result
  const dn = deviceDoc.dn;
  const name = deviceDoc.name;
  const properties = [];
  for (const prop in deviceDoc.props) {
    const link = deviceDoc.props[prop].link;

    const title = dn + ' ◆ ' + name + '.' + prop;

    properties.push({
      prop,
      did: deviceDoc._id,
      name,
      dn,
      title,
      link: link || '',
      select: link == anchor,
      enable: !link,
      clear: !!link,
      clearreq: link ? { method: 'clear', type: 'link', id: 'devicelink', nodeid, prop, link } : null,
      result: { did: deviceDoc._id, dn, name, prop, title, anchor, dialognodeid: nodeid, value: { did: nodeid, prop } }
    });
  }
  return { data: { properties } };
}


async function getChannellink({ nodeid, anchor }) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  // if (!anchor) throw { error: 'SOFTERR', message: 'Expected "anchor"!' };

  // Найти просто список каналов данного плагина
  const docs = await dm.dbstore.get('devhard', { unit: nodeid });

  // Сформировать результат, anchor нужен обязательно для формирования новой привязки!!

  const properties = [];
  // Первый пункт - новый канал, если плагин позволяет добавление нового канала вручную!
  properties.push({
    id: '__newchan', // id записи в devhard
    prop: nodeid + ' Создать новый канал',
    title: nodeid + ' Создать новый канал',
    link: '',
    enable: true,
    setreq: { method: 'set', type: 'link', id: 'channellink', nodeid, link: anchor, rowid: '__newchan' }
  });

  docs.forEach(doc => {
    const prop = doc.unit + '.' + doc.chan;
   const link = doc.did ? datautil.getDeviceTitle(doc.did)+ '.' + doc.prop : '';
    properties.push({
      id: doc._id, // id записи в devhard
      prop, // Это д б канал для показа?
      title: prop,
      link, // Существующая привязка к устройству?
      enable: !link,
      setreq: !link
        ? { method: 'set', type: 'link', id: 'channellink', nodeid, prop, link: anchor, rowid: doc._id, refresh: 'channelview.' + doc.unit }
        : null
    });
  });
  return { data: { properties } };
}
/*
data:{properties:[ {
            prop:’value’, 
            title:’DT1 Датчик температуры.value (значение)’,
            link:’modbus1.ch_1’,  // Этот link - привязка выбранного свойства устройства
            select: true, // если это канал, с которого пришли (link == selected)
            enable: false, // true если нет привязки
            clearlink: true, // true если есть привязка,
            clearreq: {body для post}  // запрос на очистку (сброс привязки), см п.5

            result: {title:’DT1 Датчик температуры.value (значение)’, // Объект готов для замены в основной форме
                       selected:’modbus1.ch_1’,
                       dialognodeid:’d0772’. 
                       fieldvalue:’d0772.value’ 
           }
      }, ...]}
*/

/**
 * Отработка method:set
 *
 * Формирует привязку устройства (свойства) к каналу (каналам)
 *
 * @param {Object}  query - объект запроса
 * @return {Array of objects} - массив документов для изменения в формате dm.update
 *
 */
// async function set({ id, nodeid, link, rowid }) {
async function set(query) {
  switch (query.id) {
    //   case 'devicelink':
    case 'channellink':
      return setChannellink(query);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}


// method=set&type=link&id=channellink&nodeid=modbus1&link=d0123.prop&rowid=<индекс в devhard>
async function setChannellink(query) {
  const { nodeid, link, rowid } = query;

  if (!rowid) throw { error: 'SOFTERR', message: 'Missing rowid!' };
  if (!link) throw { error: 'SOFTERR', message: 'Missing link!' };
  if (!nodeid) throw { error: 'SOFTERR', message: 'Missing nodeid!' };

  // Найти запись в devhard
  // TODO - возможно будет новый канал - тогда добавляем запись дефолтную для плагина
  const doc = await dm.dbstore.findOne('devhard', { _id: rowid });

  // Если нашли - сформировать запись для изменения записи
  if (!doc) throw { error: 'SOFTERR', message: 'Not found record with rowid = ' + rowid };

  const [did, prop] = link.split('.');
  if (!did || !prop) throw { error: 'SOFTERR', message: 'Invalid link!' };

  // TODO - проверить что такое устройство существует. И свойство не привязано еще?
  doc.$set = { did, prop };
  return [doc];
}


/**
 * Отработка method:set при вставке нового канала
 *
 * Формирует новую запись для канала с привязкой к свойству устройства 
 *
 * @param {Object}  query - объект запроса
 * @return {Array of objects} - документ для добавления в формате dm.insert
 *
 */
async function insert(query) {
  switch (query.id) {
  
    case 'channellink':
      return insertChannellink(query);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}

// method=set&type=link&id=channellink&nodeid=modbus1&link=d0123.prop&rowid=__newchan
async function insertChannellink(query) {
  const { nodeid, link } = query;

  if (!nodeid) throw { error: 'SOFTERR', message: 'Missing nodeid!' }; // Это id плагина

  const [did, prop] = link.split('.');
  if (!did || !prop) throw { error: 'SOFTERR', message: 'Invalid link!' };

  // TODO - проверить что такое устройство существует. И свойство не привязано еще?
  // И первоначальное заполнение из плагина??
  const doc = { unit:nodeid, chan:'newchan', did, prop };
  return [doc];
}

/**
 * Отработка method:clear, type:link
 *
 * Удаляет привязку устройства (свойства) к каналу (каналам)
 *
 * @param {Object} body - объект запроса
 * @return {Array of objects} - массив документов для изменения в формате dm.update
 *
 */
async function clear({ id, nodeid, link, prop }) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  switch (id) {
    case 'devicelink':
      return clearDevicelink(nodeid, link, prop);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + id };
  }
}

async function clearDevicelink(nodeid, link, prop) {
  // Найти привязки этого устройства: nodeid = devhard.did
  const filter = { did: nodeid };
  if (prop) filter.prop = prop;

  const docs = await dm.dbstore.get('devhard', filter);

  // Если нашли - сформировать запись для изменения записи
  // TODO - возможно и удаления, если каналы хранятся в channels??
  if (docs) {
    docs.forEach(doc => {
      doc.$set = { did: '', prop: '' };
    });
  }
  return docs;
}

/*
{
      method:’clear’,
     type:’link,
     id:’devicelink’, // имя компонента
     nodeid:’d0772’, // узел дерева
     link:’modbus1.ch_1’, // из properties
     prop:’value’ // из properties
*/

module.exports = {
  get,
  set,
  insert,
  clear
};
