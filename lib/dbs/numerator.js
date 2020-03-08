/**
 * Компонент обеспечивает генерацию уникальных идентификаторов для таблиц по заданным правилам
 * Правила нумерации для каждой таблицы прописаны в tables.json
 * В одной коллекции может быть несколько таблиц
 */

// const util = require('util');
const shortid = require('shortid');

const dbstore = require('./dbstore');

const tableIds = {}; // {pref, len, numid}


module.exports = {

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
  }
};
