/**
 * Объект для работы с префиксами устройств
 *  Структуры:
 *    dnPrefIds - объект префиксов для построения dn устройств
 *
 * Генерирует новый dn по префиксу
 *
 */

// const util = require('util');
// const hut = require('../utils/hut');

// Префиксы для именования [pref]:{len, numid}.
const dnPrefIds = {}; // [pref]:{len, numid}

module.exports = {
 
  updateDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];
        if (!dnPrefIds[pref]) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len < dig.length) {
          dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
        } else if (dnPrefIds[pref].len == dig.length) {
          if (Number(dig) > dnPrefIds[pref].numid) {
            dnPrefIds[pref] = { len: dig.length, numid: Number(dig) };
          }
        }
      }
    }
  },

  // Для генерации dn на основании префиксов
  // В каждом dn выделяем префикс, для одинаковых префиксов - сохранить мах значение мах длины
  getNewDn(pref) {
    if (!pref) return '';

    if (!dnPrefIds[pref]) {
      dnPrefIds[pref] = { len: 3, numid: 0 };
    }
    const rule = dnPrefIds[pref];
    rule.numid += 1;
    return pref + String(rule.numid).padStart(rule.len, '0');
  },

  getNewDnAsCopy(dn) {
    if (dn) {
      let pref = dn;
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        pref = dn.substr(0, marr.index);
      }
      return this.getNewDn(pref);
    }
    return '';
  },

  deleteDnPref(dn) {
    if (dn) {
      const marr = dn.match(/\d+$/);
      if (marr && marr.index) {
        const pref = dn.substr(0, marr.index);
        const dig = marr[0];

        if (dnPrefIds[pref]) {
          if (dig.length >= dnPrefIds[pref].len && Number(dig) == dnPrefIds[pref].numid) {
            dnPrefIds[pref].numid -= 1;
          }
        }
      }
    }
  }
};
