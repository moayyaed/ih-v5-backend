/**
 * documentation.js
 */

const util = require('util');
const fs = require('fs');
const appconfig = require('../appconfig');
const treeutil = require('../utils/treeutil');

async function getDocTree(query, dm) {
  const { lang = 'en', platform = 'is_v5' } = query;
  const b_array = [{ id: 'pagegroup', title: 'Docs', parent: 0 }];
  const l_array = [];

  // Получить папки из дерева
  const data = await dm.dbstore.get('pages', {}, { order: 'order' });
  console.log('getDocTree data=' + util.inspect(data, null, 4));
  for (const item of data) {
    if (!item.props || !item.props[lang]) continue;
    if (!item.folder && !item[platform]) continue;

    const node = { id: item._id, title: item.props[lang].pagename, parent: item.parent };
    if (item.folder) {
      b_array.push(node);
    } else {
      // Учесть что есть публикация
      l_array.push(node);
    }
  }
  return treeutil.makeTreeWithLeaves(b_array, l_array, {noEmpty:1 });
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

module.exports = {
  getDocTree,
  copyPage
};
