/**
 * translate - Функции перевода по словарю
 */
const util = require('util');

/**
 * Замена значений полей объекта переводом из dict
 *   Вложенные объекты обрабатываются рекурсивно
 *
 * @param {object} target - обрабатываемый объект
 * @param {object} dict - словарь
 * @param {object} second - дополнительный словарь (объект)
 *
 * Замена выполняется, если
 *   - значение атрибута - строковое поле -  начинается с $. Далее следует ключевая строка для поиска в dict
 *   - значение атрибута - ${строковое поле}. Для подстановок из дополнительного словаря (версия из config,...)
 *   - если значение по ключу не найдено, ничего не подставляется
 */
function translateObj(target, dict, second) {
  if (!target || !dict || typeof target != 'object' || typeof dict != 'object') return;
  second = second || {};

  Object.keys(target).forEach(prop => {
    if (typeof target[prop] == 'object') {
      translateObj(target[prop], dict);
    } else if (typeof target[prop] == 'string') {
      if (target[prop].indexOf('${') >= 0) {
        target[prop] = target[prop].replace(/\${(\w*)}/g, (match, p1) =>  second[p1] || '');
      } else if (target[prop].substr(0, 1) == '$') {
        let key = target[prop].substr(1);
        if (key && dict[key]) {
          target[prop] = dict[key];
        }
      }
    }
  });
  return target;
}

function translateIt(recs, dict, second) {
  if (typeof recs != 'object') return recs;

  if (Array.isArray(recs)) {
    recs.forEach(item => {
      translateObj(item, dict, second);
    });
  } else translateObj(recs, dict, second);

  return recs;
}

module.exports = {
  translateObj,
  translateIt
};
