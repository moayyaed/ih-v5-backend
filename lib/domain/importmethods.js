/**
 * importmethods.js
 *
 *  Методы загрузки прикладного уровня
 */

const util = require('util');
const shortid = require('shortid');

const appconfig = require('../appconfig');

const CSV = require('../utils/csvutil');

async function processChannels({ data, nodeid }, holder) {
  
  let channelProps = appconfig.getChannelPropsFromV5Form(nodeid);
  // if (!channelProps) return { error: 'Not found v5/channelform for ' + nodeid };
  if (!channelProps) channelProps = {'chan':'input'};
  const columns = Object.keys(channelProps);

  const docs = CSV.parse(data, { requiredFields: ['chan'] });
  const unit = nodeid;

  // Предварительно все каналы для unit удалить
  const newdocs = [];
  const olddocs = await holder.dm.get('devhard', { unit });

  if (olddocs.length) {
    console.log('REMOVE devhard DOCS: ' + olddocs.length);
    await holder.dm.removeDocs('devhard', olddocs);
  }

 
  

  const folders = {};
  let order = 0;
  docs.forEach(doc => {
    order += 10;
    const parent = doc.parent_title ? folders[doc.parent_title] : '';
    if (doc.folder_title) {
      // Это папка
      const _id = shortid.generate();
      folders[doc.folder_title] = _id;
      newdocs.push({ _id, unit, parent, order, folder:1, chan:doc.folder_title});
    }  else {
      // Канал
      const _id = unit + '_' + doc.chan;
      // Брать только поля, которые есть в канале
      // Выполнить преобразование типа атрибута: cb, number: "0" => 0
      newdocs.push({ ...formOneObj(doc), _id, unit, parent, order });
    }
  });

  console.log('INSERT devhard DOCS: ' + newdocs.length+util.inspect(newdocs));
  await holder.dm.insertDocs('devhard', newdocs);
  return { response: 1, message: 'Загружено ' + newdocs.length + ' каналов' };

  function formOneObj(dataItem) {
    const newo = {};
    columns.forEach(field => {
      const val = dataItem[field] != undefined ? dataItem[field] : '';
      newo[field] = valueByType(field, val);
    });
    return newo;
  }

  function valueByType(field, val) {
    const type = channelProps[field];
    switch (type) {
      case 'cb':
        return val>0 ? 1 : 0;
      case 'number':
        return isNaN(val) ? 0 : Number(val);
      default:
        return String(val);
    }
  }

}



module.exports = {
  csv: {
    channels: processChannels
  }
};
