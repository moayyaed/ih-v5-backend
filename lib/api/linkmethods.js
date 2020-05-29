/**
 * linkmethods.js
 * Функции отработки запросов для type:link
 * method:get, type:link,
 * method:clear, type:link,
 */

// const util = require('util');

const dm = require('../datamanager');


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

    const title = dn+' ◆ '+name + '.' + prop;
    console.log('TITLE='+title)

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
  


  // Сформировать результат, anchor используется для selected=true/false  и для result
 
  const properties = [];
  docs.forEach(doc => {
    const prop = doc.unit + '.' + doc.chan;

    const link = doc.did ?  doc.did+ '.' + doc.prop : '';
   

    properties.push({
      prop,  // Это д б канал
      did: doc.did,
   
      dn: doc.did,
      title:prop,
      link  // Привязка к устройству?
     
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
  clear
};
