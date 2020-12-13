/**
 * pluginutil.js
 * Вспомогательные функции для плагинов
 *
 */

const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');

const appconfig = require('../appconfig');


function isUnitDoc(doc) {
    return doc && !doc.folder && doc.plugin;
}
module.exports = {
  isUnitDoc
};
