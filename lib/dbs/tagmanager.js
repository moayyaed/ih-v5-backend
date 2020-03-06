/**
 * tagmanager.js
 * Компонент для работы с тэгами
 */

const util = require('util');
const hut = require('../utils/hut');

const dbstore = require('./dbstore');

module.exports = {
  start() {
    this.tagMap = new Map();
    // Загрузить из таблиц тэги - поля tags:[]
    this.tagMap.set('Свет', {'LAMP1':'devices', 'Actorxx':'types'});
    this.tagMap.set('Климат', {'VENT1':'devices', 'Actoryy':'types'});
    console.log(util.inspect(this.tagMap.keys()))
  },
  getList() {
    return Array.from(this.tagMap.keys());
  }
}
