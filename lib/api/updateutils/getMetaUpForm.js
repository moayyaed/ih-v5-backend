
const dm = require('../../datamanager');

/**
 * Сформировать вспомогательный объект для разбора формы и сохранить в кэш
 * @param {String} id - ид-р формы
 * @return {Object} Объект для разбора формы:
 * {
     records: [ { cell: 'p1', table: 'device' }, { cell: 'p2', table: 'device' } ],
     tables: [ { cell: 'p3', table: 'devicecommonTable' } ],
     alloc: {
       device: { dn: 'p1', name: 'p1', type: 'p1', parent_name: 'p1', txt: 'p2' },
       devicecommonTable: { prop: 'p3', min: 'p3', max: 'p3'}
     },
     exfieldtype:{
      mycode:{type:'code', cell:'p1'}  
     }
   }
 */


module.exports = async function getMetaUpForm({ id } ) {
  console.log('getMetaUpForm start '+id)
  // Получить саму форму
  const metaData = await dm.getCachedData({ type: 'form', id, method: 'getmeta' });
  const formMetaData = metaData.data;
  if (!formMetaData.grid) return;

  const records = [];
  const tables = [];
  const alloc = {}; // table->prop->cell
  const exfieldtype = {};

  // Сформировать записи по метаданным формы
  for (const cell of formMetaData.grid) {
    if (formMetaData[cell.id]) {
      const propMap = new Map();
      formMetaData[cell.id].forEach(item => {
        if (item.type == 'table') {
          tables.push({ cell: cell.id, table: cell.table, prop: item.prop });
          addAlloc(item.prop, item.columns, cell.id);
        } else if (item.type == 'code') {
          exfieldtype[item.prop] = {type:'code', cell:cell.id};
        } else if (cell.table) {
          // Если в плашке НЕ табличные данные
          if (!propMap.has(item.prop)) propMap.set(item.prop, item);
        }
      });
      if (propMap.size) {
        records.push({ cell: cell.id, table: cell.table });
        addAlloc(cell.table, formMetaData[cell.id], cell.id);
      }
    }
  }
  
  return { records, tables, alloc, exfieldtype };

  function addAlloc(table, arr, cellid) {
    if (!alloc[table]) alloc[table] = {};

    arr.forEach(item => {
      if (item.type != 'table') {
        alloc[table][item.prop] = cellid;
      }
    });
  }
}