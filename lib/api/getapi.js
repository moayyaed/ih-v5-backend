/**
 *
 */
// const util = require('util');

const hut = require('../utils/hut');

const descriptor = require('../descriptor');
const dm = require('../datamanager');

const dataformer = require('./dataformer');
const datautil = require('./datautil');
const tagstore = require('./tagstore');

const xform = require('./getutils/xform');

/**
 *  Получение данных по типу и идентификатору
 *    type='menu', id='pmmenu' | type='tree', id='devices'}
 *    После загрузки  сохраняются в кэше
 *
 * @param {String} type - тип объекта
 * @param {String} id - идентификатор по типу объекта
 * @param {String} nodeid - идентификатор узла, с которого пришел запрос
 * @param {String || Boolean} meta - флаг загрузки метаданных
 * @return {Object}: {data}
 */
// async function get(query, holder) {
async function get(query, holder) {
  const { type, id, nodeid, method } = query;

  const desc = descriptor.getDescItem(type, id);
  // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
  if (desc.store == 'db') {
    const data = await dm.dbstore.getData(desc);
    return { data };
  }

  if (method == 'getmeta') return dm.getCachedData(query);

  let result;
  switch (type) {
    // type=form'&id=formDeviceCommon&nodeid=xxxx
    case 'form':
      return dataformer.getRecordByForm(id, nodeid);

    case 'xform':
      return getXFormData(id, nodeid);

    // type=droplist'&id=typeList
    case 'droplist':
      return datautil.getDroplist(id);

    case 'tags':
      return { data: tagstore.getList() };

    // type=tree'&id=dev
    case 'tree':
      if (Array.isArray(desc)) return getMultiTree(id, desc);

      result = await dm.getCachedData(query, dataformer.getTree);
      return id == 'devices' ? cloneDevicesWithExpanded(result) : result;

    case 'subtree':
      return dm.getCachedData(query, dataformer.getSubTree);

    case 'popup':
      return id == 'plugincommand' ? getPopupPluginCommands(nodeid) : getPopupFromTree(id);

    case 'menu':
      return dm.getSystemData({ type, id });

    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
  }
}

async function getXFormData(id, nodeid) {
  // return { data: { p1: { name: id } } };
  // const meta = await getmeta.getMeta('xform', id);
  // const meta = await getmeta.getMeta('xform', id);
  const meta = await dm.getCachedData({ type: 'xform', id, method: 'getmeta' });

  const formMetaData = meta.data;
  const data = {};

  // Сформировать записи по ячейкам
  for (const cell of formMetaData.grid) {
    data[cell.id] = {};
    for (const item of formMetaData[cell.id]) {
      const getRes = await xform.getData(item);
      data[cell.id][item.prop] = getRes;
    }
  }
  return { data };
}

function cloneDevicesWithExpanded(dataObj) {
  const result = hut.clone(dataObj);
  if (result.data && result.data[0]) {
    result.data[0].expanded = true;
  }
  return result;
}

// TODO заглушка  Нужно взять из манифеста плагина
async function getPopupPluginCommands(nodeid) {
  if (!nodeid) throw { message: 'Expected nodeid for type=popup&id=plugincommand' };
  return {
    data: [
      { id: 'command1_' + nodeid, title: 'Command 1 ' + nodeid },
      { id: 'command2_' + nodeid, title: 'Command 2 ' + nodeid },
      { id: 'command3_' + nodeid, title: 'Command 3 ' + nodeid }
    ]
  };
}

async function getPopupFromTree(id) {
  const dataObj = await dataformer.getCachedTree(id); // Возвращает 0 элемент
  return { data: dataObj.children };
}

/**
 * Возвращает объект с деревом, составленным из нескольких деревьев (несколько node с parent=0)
 *
 * @param {String} id - идентификатор дерева
 * @return {Object}: {data, ts}
 *
 *   {data:[{"id":11,"title":"Экраны","parent":0,"children":[....]},
 *           {"id":22,"title":"Компоненты","parent":0,"children":[....]}], ts:1580409518007}
 *
 */
async function getMultiTree(id, desc) {
  // const desc = descriptor.getDescItem('tree', id);

  // result = await dm.getCachedData({type, id, nodeid}, dataformer.getTree);

  const promises = desc.map(treeId => dm.getCachedData({ type: 'tree', id: treeId }, dataformer.getTree));

  const results = await Promise.all(promises);
  let data = [];
  let ts = 0;
  results.forEach(cacheItem => {
    data = data.concat(cacheItem.data);
    if (cacheItem.ts > ts) ts = cacheItem.ts;
  });

  return { data };
}

module.exports = {
  get
};
