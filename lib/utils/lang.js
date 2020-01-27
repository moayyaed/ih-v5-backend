/**
 * lang - Функции локализации
 */

const util = require('util');
const fs = require('fs');

// const hut = require('./hut');
const appconfig = require('./appconfig');
// const jdb = require('./jdb');

exports.setLang = setLang;
exports.getLangPath = getLangPath;
exports.translateObj = translateObj;
exports.translateIt = translateIt;

function setLang() {
  // Если язык выбран - должна быть соотв папка! Если нет - то сбросить
  if (!isLangExists(appconfig.get('lang'))) appconfig.updateConfigParam('lang', '');
}

function isLangExists(lang) {
  let langdir = appconfig.get('langdir');
  return lang && langdir && fs.existsSync(langdir + '/' + lang);
}

function getLangPath() {
  let lang = appconfig.get('lang');
  return isLangExists(lang) ? appconfig.get('langdir') + '/' + lang : appconfig.get('sysbasepath');
}

/**
 * Замена значений полей объекта переводом из dict
 *   Вложенные объекты обрабатываются рекурсивно
 *
 * @param {object} target - обрабатываемый объект
 * @param {object} dict - словарь
 *
 * Замена выполняется, если
 *   - атрибут - строковое поле -  начинается с $. Далее следует ключевая строка для поиска в dict
 *   - если значение по ключу не найдено, ничего не подставляется
 */
function translateObj(target, dict) {
  if (!target || !dict || typeof target != 'object' || typeof dict != 'object') return;

  Object.keys(target).forEach(prop => {
    if (typeof target[prop] == 'object') {
      translateObj(target[prop], dict);
    } else if (typeof target[prop] == 'string') {
      if (target[prop].indexOf('${') >= 0) {
        target[prop] = target[prop].replace(/\${(\w*)}/g, (match,p1)=> appconfig.get(p1));
      }
      else if (target[prop].substr(0, 1) == '$') {
        let key = target[prop].substr(1);
        if (key && dict[key]) {
          target[prop] = dict[key];
        }
      }
    }
  });
  return target;
}

function translateIt(recs, dict) {
  if (typeof recs != 'object') return recs;

  if (util.isArray(recs)) {
    recs.forEach(item => {
      translateObj(item, dict);
    });
  } else translateObj(recs, dict);

  return recs;
}
