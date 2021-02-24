/**
 * importmethods.js
 * 
 *  Методы загрузки прикладного уровня 
 */

const util = require('util');

const appconfig = require('../appconfig');

const CSV = require('../utils/csvutil');

 async function processChannels({data, nodeid}, holder) {
  const docs = CSV.parse(data, { requiredFields: ['chan'] });

  const unit = nodeid;

  // Предварительно все каналы для unit удалить, оставить только корневую папку
  const newdocs = [];
  let rootFolder;
  const olddocs = await holder.dm.get('devhard', { unit });

  if (olddocs.length) {
    const rootIdx = getRootFolderIdx(docs);
    if (rootIdx >= 0) {
      rootFolder = docs[rootIdx];
      olddocs.splice(rootIdx, 1);
    }
    if (olddocs.length) {
      console.log('REMOVE devhard DOCS: ' + olddocs.length);
      await holder.dm.removeDocs('devhard', olddocs);
    }
  }

  let order = 0;
  let parent;
  // Нет ничего, даже корневой папки - добавить
  if (!rootFolder) {
    parent = unit + '_all';
    rootFolder = { _id: parent, folder: 1, parent: 0, chan: parent, order };
    newdocs.push(rootFolder);
  } else {
    parent = rootFolder._id;
  }

  docs.forEach(doc => {
    order += 10;
    const _id = unit + '_' + doc.chan;
    newdocs.push({ _id, unit, parent, order, ...doc });
  });

  console.log('INSERT devhard DOCS: ' + newdocs.length);
  await holder.dm.insertDocs('devhard', newdocs);
  return {message:'Загружено '+newdocs.length +' каналов'}
}
   
function getRootFolderIdx(docs) {
  // Найти корневую папку
  if (docs && docs.length) {
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].folder && !docs[i].parent) return i;
    }
  }
  return -1;
}

module.exports = {
  csv:{
    channels: processChannels
  }
}