/**
 * logserver.js
 *
 * Логирование прикладного уровня
 * - данные пишутся в таблицы через dm, которые периодически чистятся
 * - здесь же сделать запись для постоянного хранения в БД??
 *
 * - чтение выполняется напрямую из таблиц (через dm )
 */

const dm = require('../datamanager');

module.exports = async function(holder) {
  holder.on('log', (mesObj, table) => {
    if (!mesObj) return;

    if (!table) table = 'userlog';
    const docs = Array.isArray(mesObj) ? mesObj : [mesObj];
    const ts = Date.now();
    docs.forEach(item => {
      if (!item.ts) item.ts = ts;
    });
    dm.insertDocs(table, docs);
  });
};
