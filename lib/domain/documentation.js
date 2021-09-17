/**
 * documentation.js
 */

const util = require('util');
const fs = require('fs');
const appconfig = require('../appconfig');

const treeutil = require('../utils/treeutil');
const liststore = require('../dbs/liststore');

async function getDocTree(query, dm) {
  const { lang = 'en', platform = 'is_v5' } = query;
  const b_array = [{ id: 'pagegroup', title: 'Docs', parent: 0 }];
  const l_array = [];

  // Получить папки из дерева
  const data = await dm.dbstore.get('pages', {}, { order: 'order' });
  console.log('getDocTree data=' + util.inspect(data, null, 4));
  for (const item of data) {
    if (!item.props || !item.props[lang]) continue;
     // Учесть что есть публикация 
    if (!item.folder && (!item[platform] || !item.props[lang].lastpub)) continue;

    const node = { id: item._id, title: item.props[lang].pagename, parent: item.parent };
    if (item.folder) {
      b_array.push(node);
    } else {
      l_array.push(node);
    }
  }
  return treeutil.makeTreeWithLeaves(b_array, l_array, { noEmpty: 1 });
}

// вернуть страницу документации из папки для публикации с учетом алиаса
async function getDocPublicPage(query, dm) {
  let { id, lang = 'en' } = query;


  // Проверить, м б передали алиас в id
  const pageItem = liststore.findItem('pageList', {alias:id})
  if (pageItem) {
    id = pageItem.id;
  }
  const filename = appconfig.getDocPublicPageFilename(id, lang);
  if (fs.existsSync(filename)) return fs.promises.readFile(filename, 'utf8');

  return '';
}

async function copyPage(oldId, doc) {
  const ts = Date.now();
  const props = doc.props;
  if (props) {
    for (const lang of Object.keys(props)) {
      const from = appconfig.getDocPageFilename(oldId, lang);
      const to = appconfig.getDocPageFilename(doc._id, lang);
      if (fs.existsSync(from)) {
        await fs.promises.copyFile(from, to);
        doc.props[lang].lastmodif = ts;
      } else {
        doc.props[lang].lastmodif = 0;
      }
      doc.props[lang].lastpub = 0;
    }
  }
}

/*
 method: 'row_command', type: 'form', id: 'formPageCommon', command: 'publishpage', 
 nodeid: 'pg008', payload: { _id: 'ru', id: 'ru', newid: 'ru', pagename: '@@@@@О плагинах', lastmodif: 1631865187821, lastmodifStr: '17.09.21 10:53:07.821', rowbutton: { title: 'Опубликовать', command: 'publishpage' } }, 
 userId: 'u0003', __expert: 1 }
 */
async function publishPage(query, holder) {
  try {
    if (!query.nodeid) throw { message: 'Missing nodeid!' };
    if (!query.payload) throw { message: 'Missing payload!' };
    if (!query.payload.id) throw { message: 'Missing payload.id (expected lang).' };
    const id = query.nodeid;
    const lang = query.payload.id;
    // Найти запись, поместить дату публикации
    const doc = await holder.dm.findRecordById('pages', id);
    if (!doc) throw { message: 'Record not found!' };
    if (!doc.props || !doc.props[lang]) throw { message: 'Not found lang ' + lang + ' in pages doc!' };

    // Найти файл для публикации
    const from = appconfig.getDocPageFilename(id, lang);
    if (!fs.existsSync(from)) throw { message: 'Empty page or source file not found!' };

    const to = appconfig.getDocPublicPageFilename(id, lang);
    await fs.promises.copyFile(from, to);

    await holder.dm.updateDocs('pages', [{ _id: id, $set: { ['props.' + lang + '.lastpub']: Date.now() } }]);
    // doc: { ['props.' + lang + '.lastmodif']: ts }
    return { refresh: true };
  } catch (e) {
    throw { message: 'Publish Error: ' + e.message };
  }
}

module.exports = {
  getDocTree,
  getDocPublicPage,
  copyPage,
  publishPage
};
