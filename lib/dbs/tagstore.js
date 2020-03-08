/**
 * tagmanager.js
 * Компонент для работы с тэгами
 */

const util = require('util');
const hut = require('../utils/hut');

// const dbstore = require('./dbstore');

module.exports = {
  start() {
    this.tagMap = new Map();
    // Загрузить из таблиц тэги - поля tags:[]
    /*
    this.tagMap.set('Свет', { LAMP1: 'devices', Actorxx: 'types' });
    this.tagMap.set('Климат', { VENT1: 'devices', Actoryy: 'types' });
    let collection = 'types';
    const res = await dbstore.get('types', { tags: { $exists: true } }, { fields: { tags: 1 } });
    console.log('EXISTS ' + util.inspect(res));
    // { tags: [ 'Свет' ], _id: 't100'}
    if (res) {
      res.forEach(doc => this.addTags(doc.tags, doc._id, collection));
    }
    console.log('this.tagMap ' + util.inspect(this.tagMap));
    */
  },

  getList() {
    return Array.from(this.tagMap.keys());
  },

  addFromDocs(docs, collection) {
    if (!docs || !Array.isArray(docs)) return;
    docs.forEach(doc => this.add(doc.tags, doc._id, collection));
    console.log('this.tagMap ' + util.inspect(this.tagMap));
  },

  add(tags, id, collection) {
    if (!tags || !Array.isArray(tags)) return;
    tags.forEach(word => {
      if (!this.tagMap.has(word)) {
        this.tagMap.set(word, { [id]: collection });
      } else {
        this.tagMap.set(word, Object.assign(this.tagMap.get(word), { [id]: collection }));
      }
    });
  },

  update(oldtags, newtags, id, collection) {
    console.log('oldtags =' + oldtags.join());
    console.log('newtags =' + newtags.join());
    if (!oldtags || !Array.isArray(oldtags)) oldtags = [];
    if (!newtags || !Array.isArray(newtags)) newtags = [];
    if (!oldtags.length && !newtags.length) return;

    // Выделить удаленные и добавленные
    const toDelete = newtags.length ? oldtags.filter(item1 => newtags.some(item2 => item1 != item2)) : oldtags;
    console.log('toDelete =' + toDelete.join());
    this.delete(toDelete, id, collection);
    const toAdd = oldtags.length ? newtags.filter(item1 => oldtags.some(item2 => item1 != item2)) : newtags;
    console.log('toAdd =' + toAdd.join());
    this.add(toAdd, id, collection);
  },

  delete(tags, id) {
    if (!tags || !Array.isArray(tags)) return;
    tags.forEach(word => {
      if (this.tagMap.has(word)) {
        const valObj = this.tagMap.get(word);
        if (valObj && valObj[id]) {
          delete valObj[id];
          if (hut.isObjIdle(valObj)) {
            this.tagMap.delete(word);
          }
        }
      }
    });
  },

  clear() {
    this.tagMap.clear();
  },
  getSize() {
    return this.tagMap.size;
  }
};
