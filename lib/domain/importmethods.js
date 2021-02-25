/**
 * importmethods.js
 *
 *  Методы загрузки прикладного уровня
 */

const util = require('util');
const shortid = require('shortid');

// const appconfig = require('../appconfig');

const CSV = require('../utils/csvutil');

async function processChannels({ data, nodeid }, holder) {
  const docs = CSV.parse(data, { requiredFields: ['chan'] });

  const unit = nodeid;

  // Предварительно все каналы для unit удалить
  const newdocs = [];
  const olddocs = await holder.dm.get('devhard', { unit });

  if (olddocs.length) {
    console.log('REMOVE devhard DOCS: ' + olddocs.length);
    await holder.dm.removeDocs('devhard', olddocs);
  }

  let order = 0;
 
  console.log()

  const folders = {};
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
      newdocs.push({ ...doc, _id, unit, parent, order });
    }
  });

  console.log('INSERT devhard DOCS: ' + newdocs.length+util.inspect(newdocs));
  await holder.dm.insertDocs('devhard', newdocs);
  return { response: 1, message: 'Загружено ' + newdocs.length + ' каналов' };
}



module.exports = {
  csv: {
    channels: processChannels
  }
};
