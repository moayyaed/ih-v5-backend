/**
 * linkmethods.js
 * Функции отработки запросов для type:link
 * method:get, type:link,
 * method:clear, type:link,
 */

// const util = require('util');

// const hut = require('../utils/hut');
// const treeutil = require('../utils/treeutil');

const dbstore = require('../dbs/dbstore');

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
      return  getDevicelink(query);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected id:' + query.id };
  }
}

async function getDevicelink({ nodeid, anchor }) {
  if (!nodeid) throw { error: 'SOFTERR', message: 'Expected "nodeid"!' };
  if (!anchor) throw { error: 'SOFTERR', message: 'Expected "anchor"!' };

  // Найти устройство: nodeid = devices._id
  const deviceDoc = await dbstore.findOne('devices', { _id: nodeid });
  if (!deviceDoc) throw { error: 'ERR', message: 'Device not found: ' + nodeid };

  // Найти привязки этого устройства: nodeid = devhard.did
  const devhardDocs = await dbstore.get('devhard', { did: nodeid });
  // Привязок может не быть, это нормально. Если есть - включим их в prop устройства
  if (devhardDocs && devhardDocs.length) {
    devhardDocs.forEach(doc => {
      const prop = doc.prop;
      if (deviceDoc.props[prop]) {
        deviceDoc.props[prop].link = doc.unit + '.' + doc.chan;
      }
    });
  }

  // Сформировать результат, anchor используется для selected=true/false  и для result
  const deviceName = deviceDoc.name;
  const properties = [];
  for (const prop in deviceDoc.props) {
    const link = deviceDoc.props[prop].link;
    const title = deviceName + '.' + prop;

    properties.push({
      prop,
      title,
      link: link || "",
      select: link == anchor,
      enable: !link,
      clear: !!link,
      clearreq: link ?  {method:'clear', type:'link',  id:'devicelink', nodeid, prop, link} : null,
      result: { title, anchor, dialognodeid: nodeid, value: nodeid + '.' + prop }
    });
  }

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


module.exports = {
  get
};
