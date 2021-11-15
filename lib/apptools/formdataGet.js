/**
 * formdataGet.js
 * Формирует данные для форм
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');

const descriptor = require('../descriptor');
const datautil = require('./datautil');
const treeGet = require('./treeGet');
const smartbutton = require('../domain/smartbutton');


module.exports = async function(query, holder) {
  const dm = holder.dm;

  // id - идентификатор формы
  // nodeid - идентификатор узла, с которого пришел запрос
  // navnodeid - идентификатор узла основного дерева, если пришли от submenu/subtree
  // 
  let { id, nodeid, rowid, navnodeid } = query;

  // Имена таблиц и список полей получаем из формы. Форма обычно д б кэширована
  const metaData = await dm.getCachedData({ type: 'form', id, nodeid, method: 'getmeta' });
  const data = {};

  const formMetaData = metaData.data;
  const dataFromTable = {};
  const formId = id;

  // Для некоторых форм (вызываемых из subtree) nodeid приходит не как _id записи, а как link (d0800.value)
  // - определить nodeid = _id записи на основании nodeid=d001.value или rowid - уже есть id записи из диалога например
  // То же самое нужно проделать при записи (update?)

  const preNodeid = nodeid;
  if (datautil.isLink(nodeid)) {
    nodeid = await dm.datagetter.getRecordIdByLink(id, nodeid, rowid, dm);
  } else if ((formId == 'formIntegration' || formId == 'formTypeIntegration') && navnodeid) {
    // Создать запись, если ее нет
    const doc = await dm.datamaker.findOrAddIntegrationDoc({ formId, app: nodeid, id: navnodeid }, dm);
    nodeid = doc._id;
  }
  // console.log(formId+' getRecordByForm preNodeid ' + preNodeid + ' nodeid=' + nodeid);

  try {
    if (!formMetaData || !formMetaData.grid) {
      // throw new Error('No "grid" prop in form!');
      return { data };
    }

    // Получить данные для формирования записей
    for (const cell of formMetaData.grid) {
      // Получить имя таблицы для каждой ячейки. Считать запись полностью (один раз для нескольких ячеек)
      // if (nodeid && cell.table && !dataFromTable[cell.table]) {

      if (cell.table && !dataFromTable[cell.table]) {
        const desc = descriptor.getTableDesc(cell.table) || { store: 'none' };
        // console.log('getRecordByForm cell.table='+cell.table+'  desc= ' + util.inspect(desc));

        if ((nodeid && nodeid != 'undefined') || cell.nodeid) {
          if (desc.store == 'db') {
            dataFromTable[cell.table] = datautil.isNewRecord(nodeid)
              ? // {table, filter, item, parentid, body}
                await dm.datamaker.createOneRecord(
                  { table: cell.table, filter: {}, item: {}, parentid: preNodeid, body: query },
                  dm
                )
              : await dm.dbstore.findOne(desc.collection, { _id: nodeid });
          } else if (desc.store == 'tree') {
            // данные берем из дерева в форме плоской таблицы с полем  path
            // получить все листья из вложенных папок, затем в том же порядке их показать
            /*
            const treeRootItem = await dm.getCachedTree({id:desc.tree});

            const arr = await treeutil.getLeavesForTable(treeRootItem, nodeid);
            arr.forEach(item => {
              item.path = treeguide.getPath(desc.tree, item.id, nodeid);
            });
            // TODO - заменить на await getDataFromTree(desc.tree, nodeid)
            dataFromTable[cell.table] = arr;
            */
            dataFromTable[cell.table] = await treeGet.getDataFromTree(desc.tree, nodeid, dm);
          } else if (desc.store == 'none') {
            if (dm.datagetter.isVirttable(cell.table)) {
              dataFromTable[cell.table] = await dm.datagetter.getVirttable(
                cell.table,
                [],
                cell.table,
                nodeid,
                formMetaData[cell.id][0],
                holder,
                id
              );
            }
          }

          if (dm.datagetter.isRealtimeTable(cell.table)) {
            // Добавить данные для показа текущих значений - с каналов и/или с устройств
            dataFromTable.realtime = await dm.datagetter.getRealtimeValues(cell.table, id, nodeid, holder);
          }
        } else if (desc.store == 'tree') {
          // Загрузить таблицу из дерева без nodeid
          dataFromTable[cell.table] = await treeGet.getDataFromTree(desc.tree, '', dm);
        }
      }
    }

    // console.log('dataFromTable = ' + util.inspect(dataFromTable));

    // Сформировать записи по ячейкам
    for (const cell of formMetaData.grid) {
      if (formMetaData[cell.id]) {
        // Если плашки не в форме - пропускаем
        data[cell.id] = {};
        for (const item of formMetaData[cell.id]) {
          if (item.type == 'table') {
            if (!item.columns) throw new Error('Expected "columns" in item: ' + util.inspect(item));
            data[cell.id][item.prop] = await getTableData(cell.table, item);
          } else if (datautil.isDerivative(item.prop)) {
            data[cell.id][item.prop] =
              query[item.prop] != undefined
                ? query[item.prop]
                : datautil.derivativeValue(item.prop, getRecord(cell.table), holder);
          } else if (item.type == 'images') {
            data[cell.id][item.prop] = getIdArray(cell.table);
          } else if (item.type == 'image') {
            data[cell.id][item.prop] = getId(cell.table);
          } else if (item.prop == 'extlog') {
            data[cell.id][item.prop] = await getExtlog(item.param, nodeid);
          } else if (item.type == 'code' || item.type == 'script' || item.type == 'markdown') {
            data[cell.id][item.prop] = await dm.datagetter.getFieldFromFile(item.prop, cell.table, query);
            // } else if (item.type == 'markdown') {
            // data[cell.id][item.prop] = await getMarkdown(cell.table, preNodeid);
          } else if (datautil.isExfieldtype(item.type)) {
            // Загрузить из файла в виде объекта - layout, container (возможно, из кэша??)
            data[cell.id][item.prop] = await dm.datagetter.getProjectData(item.type, nodeid, dm);
          } else if (item.type == 'smartbutton') {
            data[cell.id][item.prop] = await getSmartbuttonData(cell.table, item, nodeid);
          } else if (item.type == 'link') {
            data[cell.id][item.prop] = await getLinkData(cell.table, item);
            // console.log('LINK  item.prop='+item.prop+'='+util.inspect(data[cell.id][item.prop]))
          } else if (cell.table && foundData(cell.table, item.prop, preNodeid)) {
            data[cell.id][item.prop] = await getData(cell.table, item, preNodeid);
          } else if (item.default) {
            data[cell.id][item.prop] = item.default;
          } else data[cell.id][item.prop] = datautil.getEmptyValue(item.type);
        }
      }
    }
  } catch (e) {
    throw { error: 'SOFTERR', message: 'Unable prepare data for form ' + id + util.inspect(e) };
  }
  return { data };

  async function getExtlog(param, lid) {
    try {
      const log = await fut.readLogTail(datautil.getLogFilename(param, lid), 16000);
      return log;
    } catch (e) {
      return hut.getShortErrStr(e);
    }
  }

  function foundData(table, prop, cNodeid) {
    // Если пришел массив - проверить первый элемент
    if (!dataFromTable[table]) return;
    let record = Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];
    if (record && datautil.isLink(cNodeid) && dm.datagetter.isVirttable(table)) {
      return true;
    }
    return record && record[prop] != undefined;
    // return dataFromTable[table] && dataFromTable[table] && dataFromTable[table][prop] != undefined;
  }

  function getRecord(table) {
    return Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];
  }

  async function getData(table, item, cNodeid) {
    if (dataFromTable[table] == undefined) throw { err: 'SOFTERR', message: 'Not found data from table: ' + table };
    if (!dataFromTable[table]) return '';

    const spec = ['droplist', 'text'];

    // Если пришел массив - взять из первого элемент
    // const record = Array.isArray(dataFromTable[table]) ? dataFromTable[table][0] : dataFromTable[table];

    // Если пришел массив - взять из первого элемент
    let record = getRecord(table);
    if (datautil.isLink(cNodeid) && dm.datagetter.isVirttable(table)) {
      record = await dm.datagetter.getVirttable(table, dataFromTable, table, cNodeid, item, holder);
    }

    const value = record[item.prop];
    if (!spec.includes(item.type)) return value;

    switch (item.type) {
      case 'text':
        return item.prop.endsWith('ts') ? tryFormDateString(value) : value;
      case 'droplist':
        // __devcmd, __devprop
        if (typeof item.data == 'string' && item.data.startsWith('__'))
          return value ? { id: value, title: value } : { id: '-', title: '' };

        return dm.datagetter.getDroplistItem(item.data, value);
      default:
        return '';
    }
  }

  async function getTableData(table, item) {
    return dm.datagetter.isVirttable(table)
      ? dm.datagetter.getVirttable(table, dataFromTable, table, nodeid, item, holder)
      : formTableData(table, item);
    // : tabledata.formTableData(dataFromTable, table, nodeid, item, holder);
    // return tabledata.get(dataFromTable, table, nodeid, item, holder);
  }

  async function formTableData(table, item) {
    const pObj = getGenfieldObjFromDataRecord(table, item);
    if (!pObj || hut.isObjIdle(pObj)) return [];

    // Преобразовать в массив, ключ всегда преобразуется в id + newid
    const arr = hut.transfromFieldObjToArray(pObj);

    // Сформировать данные по столбцам
    return dm.tabledataFit(table, item.columns, arr, nodeid);
  }

  function getGenfieldObjFromDataRecord(table, pitem) {
    let rec = dataFromTable[table];

    // Запись загружена - нужно сформировать: развести в массив и уточнить состав полей
    const desc = descriptor.getTableDesc(table);
    const genfield = pitem.genfield || desc.genfield;
    const genfilter = pitem.genfilter || desc.genfilter;
    const result = rec && rec[genfield] ? rec[genfield] : '';
    return result && genfilter ? hut.getFilteredObject(result, genfilter) : result;
  }

  function getIdArray(table) {
    // Формируется из таблицы, которая строится из tree
    // Не брать, если внутри вложенной папки
    // return dataFromTable[table] ? dataFromTable[table].filter(item => !item.path).map(item => item.id) : [];
    // БРАТЬ все, в том числе внутри вложенной папки
    return dataFromTable[table] ? dataFromTable[table].map(item => item.id) : [];
  }

  function getId(table) {
    return dataFromTable[table] ? dataFromTable[table].id || dataFromTable[table]._id : '';
  }

  async function getSmartbuttonData(table, item) {
    if (!item || !item.params) throw { err: 'SOFTERR', message: 'Expected params object for type:"smartbutton" ' };

    const dataItem = dataFromTable[table]
      ? Array.isArray(dataFromTable[table])
        ? dataFromTable[table][0]
        : dataFromTable[table]
      : '';

    // {dialog, dataItem, nodeid, rowid}
    return smartbutton.get({ dialog: item.params.dialog, dataItem, nodeid: preNodeid, rowid }, dm);
  }

  async function getLinkData(table, col) {
    const dataItem = dataFromTable[table]
      ? Array.isArray(dataFromTable[table])
        ? dataFromTable[table][0]
        : dataFromTable[table]
      : '';
    // console.log('getLinkData '+table+' col='+util.inspect(col)+' dataItem='+util.inspect(dataItem))
    return dm.datagetter.formLinkObj(table, col, dataItem, dataItem[col.prop]);
  }
};

function tryFormDateString(value) {
  if (!value || isNaN(value) || value < 946674000000) return value;
  try {
    return hut.getDateTimeFor(new Date(value), 'reportdt');
  } catch (e) {
    return value;
  }
}
