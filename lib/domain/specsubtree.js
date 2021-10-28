/**
 * specsubtree.js
 *
 */

// const util = require('util');

// const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const descriptor = require('../descriptor');
const domaindata = require('../domain/domaindata');
const documentation = require('../domain/documentation');

const typestore = require('../device/typestore');
const treeguide = require('../api/treeguide');
const treeutil = require('../utils/treeutil');


const specsubtree = {
  typeprops: getTypeprops,
  typealerts: getTypealerts,
  devicepropswithlinks: getDevicepropswithlinksSubtree,
  channels: getChannelsSubtree,
  channelsx: getChannelsxTree,
  journalsrc: getJournalsrc,
  doclangs: getDocLangs,
  doclangsedit: getDocLangs,
  doclangsview: getDocLangs,
  integrations: getIntegrations,
  typeintegrations: getTypeIntegrations,
  docs: getDocTree
};

function isSpecSubtree(id) {
  return !!specsubtree[id];
}

async function getSpecSubtree(query, dm) {
  const { id } = query;
  return typeof specsubtree[id] == 'function' ? specsubtree[id](query, dm) : [];
}

async function getDocTree (query, dm) {
  // { type: 'tree', id: 'docs', lang: 'ru', conf:'ih_v5' }
  // Формировать дерево заново прямо из таблицы
  return documentation.getDocTree (query, dm);
  
}

async function getJournalsrc(query, dm) {
  const list = await domaindata.getDroplist('journalsrcList');
  if (!list || !list.data) return [];

  const journals = list.data.filter(item => item.id && item.id != '-');
  return journals.map((item, idx) => ({
    id: item.id,
    title: item.title,
    order: idx,
    parent: 0
    // component: 'formJlevels'
  }));
}


async function getDocLangs(query, dm) {
  return documentation.getDocLangList(dm);

  /*
  return ['ru','en'].map((item, idx) => ({
    id: item,
    title: item=='ru' ? 'RU' : 'ENG',
    order: idx
  
  }));
  */
}


async function getChannelsSubtree({ nodeid }, dm) {
  if (!nodeid) return;

  const id = 'channels';
  // Эта структура создается из расчета использования КАНАЛОВ!! unit: nodeid component: 'channelview.' + nodeid
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const docs = await dm.dbstore.get(b_desc.collection, { unit: nodeid }, { order: 'order' });
  const b_array = docs.filter(doc => doc.folder).map(doc => dm.datagetter.formSubTreeBranchItem(doc, id, nodeid));
  const l_array = docs.filter(doc => !doc.folder).map(doc => dm.datagetter.formSubTreeLeafItem(doc, id, nodeid));

  // Если совсем пусто - добавить запись для корневой папки, чтобы можно было добавлять
  if (!b_array.length && !l_array.length) {
    await dm.insertDocs(desc.branch.table, [{ _id: nodeid + '_all', unit: nodeid, chan: 'ALL', parent: 0, folder: 1 }]);
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

// Для вывода диалога выбора каналов при привязке к виджету
async function getChannelsxTree({ nodeid }, dm) {
  const id = 'channels';
  // Эта структура создается из расчета использования КАНАЛОВ!! unit: nodeid component: 'channelview.' + nodeid
  const desc = descriptor.getDescItem('tree', id);

  const b_desc = descriptor.getDescItem('table', desc.branch.table);
  const docs = await dm.dbstore.get(b_desc.collection, { unit: nodeid }, { order: 'order' });
  const b_array = docs.filter(doc => doc.folder).map(doc => formChannelsxTreeBranchItem(doc));
  const l_array = docs.filter(doc => !doc.folder).map(doc => formChannelsxTreeLeafItem(doc));

  // Если совсем пусто - добавить запись для корневой папки, чтобы можно было добавлять
  if (!b_array.length && !l_array.length) {
    b_array.push({ id: nodeid + '_all', title: 'ALL', parent: 0 });
  }

  let data = treeutil.makeTreeWithLeaves(b_array, l_array);
  if (data && data.length > 1) {
    data.forEach(item => delete item.parent);
    data.sort(hut.byorder('order'));
  }
  return data;
}


function formChannelsxTreeLeafItem(doc) {
  const id = doc.chan || doc._id;
  const title = doc.name || id;
  return { id, title, parent: doc.parent || 0, order: doc.order };
}

function formChannelsxTreeBranchItem(doc) {
  const title = doc.name || doc.chan;
  return { id: doc._id, title, parent: doc.parent || 0, order: doc.order };
}

async function getDevicepropswithlinksSubtree({ nodeid }, dm) {
  const data = [];
  let order = 0;
  const proparr = await domaindata.getDevicePropsForHardLink(nodeid, dm);

  proparr.forEach(prop => {
    order++;
    let id = nodeid + '.' + prop;
    let title = prop;
    data.push({ id, title, order, component: 'channellink' });
  });
  return data;
}

async function getTypeprops({ nodeid }, dm) {
  const data = [];
  let order = 0;
  // const proparr = typestore.getPropArray(nodeid);
  const typeObj = typestore.getTypeObj(nodeid);
  if (!typeObj || !typeObj.props) return [];

  Object.keys(typeObj.props).forEach(prop => {
    if (typeObj.props[prop].fuse) {
      order++;
      data.push({ id: nodeid + '.' + prop, title: prop, order });
    }
    if (typeObj.props[prop].format == 2) {
      order++;
      data.push({ id: nodeid + '._format_' + prop, title: prop + '#string', order });
    }
  });
  if (typeObj.item.scriptOnChange) data.push({ id: nodeid + '._OnChange', title: 'OnChange', order });
  if (typeObj.item.scriptOnInterval) data.push({ id: nodeid + '._OnInterval', title: 'OnInterval', order });
  if (typeObj.item.scriptOnSchedule) data.push({ id: nodeid + '._OnSchedule', title: 'OnSchedule', order });
  if (typeObj.item.scriptOnBoot) data.push({ id: nodeid + '._OnBoot', title: 'OnBoot', order });

  return data;
}

async function getTypealerts({ nodeid }, dm) {
  const data = [];
  let order = 0;
  // const proparr = typestore.getPropArray(nodeid);
  const typeObj = typestore.getTypeObj(nodeid);
  if (!typeObj || !typeObj.props) return [];

  Object.keys(typeObj.props).forEach(prop => {
    if (typeObj.props[prop].ale) {
      order++;
      data.push({ id: nodeid + '.' + prop, title: prop, order });
    }
  });

  return data;
}

function getIntegrations() {
  return domaindata.getListAsArray('integrationList')
  /*
  return [
    {id:'applehomekit', title:'Apple HomeKit'}
  ];
  */

}

function getTypeIntegrations() {
  const arr = domaindata.getListAsArray('integrationList');
  return arr;
}

module.exports = {
  isSpecSubtree,
  getSpecSubtree
};
