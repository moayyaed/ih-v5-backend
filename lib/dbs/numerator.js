/**
 * Компонент обеспечивает генерацию уникальных идентификаторов для таблиц по заданным правилам
 * Правила нумерации для каждой таблицы прописаны в tables.json
 * В одной коллекции может быть несколько таблиц
 */

const util = require('util');
const shortid = require('shortid');

const dbstore = require('./dbstore');

const tableIds = {}; // [table]:{pref, len, numid}
const dnPrefIds = {}; // [pref]:{len, numid}

module.exports = {
  // Запускается для каждой таблицы, исп для _id записей
  async createNumerator(table, tableDesc) {
    if (!tableDesc || !tableDesc.ruleID) return; // Если правила нет - генерируется shortid

    const rule = tableDesc.ruleID;
    tableIds[table] = { pref: rule.pref, len: rule.len, numid: 1 }; // len - это длина числовой части!!

    // Найти существующие ключи, созданные по заданному правилу: prefix+от 2 до 5 чисел ()
    // const regexp = new RegExp("^p\\d{2,5}$");
    const regexp = new RegExp('^' + rule.pref + '\\d{' + String(rule.len - 1) + ',' + String(rule.len + 2) + '}$');
    const res = await dbstore.get(tableDesc.collection, { _id: regexp }, { fields: { _id: 1 } });

    if (res && res.length) {
      const keys = res.map(item => item._id);

      // Среди ключей с максимальной длиной выбрать максимальное значение??
      let xkey = keys[0];
      let len = xkey.length;
      keys.forEach(el => {
        if (el.length > len) {
          xkey = el;
          len = xkey.length;
        } else if (el.length == len && xkey < el) {
          xkey = el;
        }
      });

      tableIds[table].numid = Number(xkey.substr(rule.pref.length));
    }
  },

  getNewId(table) {
    if (!table || !tableIds[table]) return shortid.generate();

    const rule = tableIds[table];
    rule.numid += 1;
    return rule.pref + String(rule.numid).padStart(rule.len, '0');
  },

  // Для генерации dn на основании префиксов
   // В каждом dn выделяем префикс, для одинаковых префиксов - сохранить мах значение мах длины
  async createDnNumerator() {
    const res = await dbstore.get('devices', {}, { fields: { dn: 1 }, order: 'dn' });
    res.forEach(item => this.updateDnPref(item.dn));
  },

  getNewDn(pref) {
    if (!pref) return shortid.generate();

    if (!dnPrefIds[pref]) {
      dnPrefIds[pref] = { len: 2, numid: 0 };
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
    return shortid.generate();
  },

  // Может присвоиться пользователем - нужно обновлять
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
