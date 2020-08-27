/**
 * customcomponents.js
 *
 *  Экспортирует таблицу функций для формирования данных прикладного уровня:
 *   - формы, деревья, popup
 *
 *   - Вызывается из dataformer
 */

const hut = require('../utils/hut');
const dm = require('../datamanager');
const descriptor = require('../descriptor');
const datagetter = require('./datagetter');

const typestore = require('../device/typestore');
const treeguide = require('../api/treeguide');
const treeutil = require('../utils/treeutil');

async function getChannelsSubtree(nodeid) {
  const id = 'channels';
  // Эта структура создается из расчета использования КАНАЛОВ!! unit: nodeid component: 'channelview.' + nodeid
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const docs = await dm.dbstore.get(b_desc.collection, { unit: nodeid }, { order: 'order' });

  const b_array = docs
    .filter(item => item.folder)
    .map(item => ({
      id: item._id,
      title: item.chan,
      parent: item.parent || 0,
      order: item.order,
      component: 'channelfolder.' + nodeid
    }));

  const l_array = docs.filter(doc => !doc.folder).map(doc => datagetter.formSubTreeLeafItem(doc, id, nodeid));

  // Если совсем пусто - добавить запись для корневой папки, чтобы можно было добавлять
  if (!b_array.length && !l_array.length) {
    await dm.insertDocs(desc.branch.table, [{ _id: nodeid + '_all', unit: nodeid, name: 'ALL', parent: 0, folder: 1 }]);
    b_array.push({ id: nodeid + '_all', title: 'ALL', parent: 0 });
  }

  // Создать treeguide заново
  treeguide.create(id, b_array, l_array, desc);

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);
  if (data && data.length > 1) {
    data.forEach(item => delete item.parent);
    data.sort(hut.byorder('order'));
  }

  return data;
}

async function getDevicepropswithlinksSubtree(nodeid) {
  const data = [];
  let order = 0;
  const proparr = await datagetter.getDevicePropsForHardLink(nodeid);

  proparr.forEach(prop => {
    order++;
    let id = nodeid + '.' + prop;
    let title = prop;
    data.push({ id, title, order, component: 'channellink' });
  });
  return data;
}

async function getTypeprops(nodeid) {
  const data = [];
  let order = 0;
  // const proparr = typestore.getPropArray(nodeid);
  const typeObj = typestore.getTypeObj(nodeid);
  if (!typeObj || !typeObj.props) return [];

  Object.keys(typeObj.props).forEach(prop => {
    order++;
    data.push({ id: nodeid + '.' + prop, title: prop, order });
  });
  return data;
}

module.exports = {
  subtree: {
    typeprops: getTypeprops,
    devicepropswithlinks: getDevicepropswithlinksSubtree,
    channels: getChannelsSubtree
  }
};
