/**
 * tagmanager.js
 * Компонент для работы с тэгами
 */

// const util = require('util');
const hut = require('../utils/hut');

module.exports = {
  start() {
    this.tagMap = new Map();
    // Загрузить из таблиц тэги - поля tags:[]
    /*
    this.tagMap.set('Свет', { LAMP1: 'devices', Actorxx: 'types' });
    this.tagMap.set('Климат', { VENT1: 'devices', Actoryy: 'types' });
    */
  },

  getList() {
    return Array.from(this.tagMap.keys());
  },

  addFromDocs(docs, collection) {
    if (!docs || !Array.isArray(docs)) return;
    docs.forEach(doc => this.add(doc.tags, doc._id, collection));
  },

  add(tags, id, collection) {
    if (!tags || !Array.isArray(tags)) return;
    tags.forEach(xword => {
      const word = hut.allTrim(xword);
      if (!this.tagMap.has(word)) {
        this.tagMap.set(word, { [id]: collection });
      } else {
        this.tagMap.set(word, Object.assign(this.tagMap.get(word), { [id]: collection }));
      }
    });
  },

  update(oldtags, newtags, id, collection) {
    if (!oldtags || !Array.isArray(oldtags)) oldtags = [];
    if (!newtags || !Array.isArray(newtags)) newtags = [];
    if (!oldtags.length && !newtags.length) return;

    // Выделить удаленные и добавленные
    const toDelete = newtags.length ? oldtags.filter(item1 => newtags.every(item2 => item1 != item2)) : oldtags;
    this.delete(toDelete, id, collection);

    const toAdd = oldtags.length ? newtags.filter(item1 => oldtags.every(item2 => item1 != item2)) : newtags;
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
