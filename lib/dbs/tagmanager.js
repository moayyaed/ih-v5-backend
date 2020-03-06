/**
 * tagmanager.js
 * Компонент для работы с тэгами
 */

const util = require('util');
// const hut = require('../utils/hut');

const dbstore = require('./dbstore');

module.exports = {
  async start() {
    this.tagMap = new Map();
    // Загрузить из таблиц тэги - поля tags:[]
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
  },

  getList() {
    return Array.from(this.tagMap.keys());
  },

  processInput(tags) {
    // Пришел массив, слова нужно включить в словарь
  },

  addTags(tags, id, collection) {
    tags.forEach(word => {
      if (!this.tagMap.has(word)) {
        this.tagMap.set(word, { [id]: collection });
      } else {
        this.tagMap.set(word, Object.assign(this.tagMap.get(word), { [id]: collection }));
      }
    });
  }
};
