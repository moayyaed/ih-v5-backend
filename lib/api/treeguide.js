/**
 * Объект для работы с деревьями.
 *   treeMap хранит для каждого дерева объекты - узлы, ключ - id узла
 *   Используется для построения breadcrumbs
 *   Раздел дерева всегда создается заново при перегенерации дерева (после сброса кэша)
 *   При изменении узлов редактируется, а не сбрасывается, так как дерево часто заново не запрашивается
 *    => перегенерация происходит не всегда!
 */

const util = require('util');

const descriptor = require('../descriptor');

module.exports = {
  start() {
    this.treeMap = {};
  },

  get(treeId) {
    return this.treeMap[treeId];
  },

  getItem(treeId, nodeId) {
    return this.treeMap[treeId] ? this.treeMap[treeId][nodeId] : '';
  },

  create(treeId, b_array, l_array, desc) {
    const tree_guide = {};

    b_array.forEach(item => {
      tree_guide[item.id] = {
        id: item.id,
        title: item.title,
        parent: item.parent,
        table: desc.branch.table
      };
    });
    l_array.forEach(item => {
      tree_guide[item.id] = {
        id: item.id,
        title: item.title,
        parent: item.parent,
        table: desc.leaf.table,
        leaf: true
      };
    });
    this.treeMap[treeId] = tree_guide;
    console.log('treeguide.create exit')
    return tree_guide;
  },

  addItem(treeId, nodeId, item) {
    if (!this.treeMap[treeId]) this.treeMap[treeId] = {};
    this.treeMap[treeId][nodeId] = item;
  },

  addItems(treeId, items, table) {
    if (!items || !items.length) return;

    const commonObj = {};
    if (table)  commonObj.table = table;  
    items.forEach(item => {
      if (item.id) this.addItem(treeId, Object.assign({}, commonObj, item));
    });
  },

  updateItem(treeId, nodeId, item) {
    if (!this.treeMap[treeId]) this.treeMap[treeId] = {};
    if (!this.treeMap[treeId][nodeId]) this.treeMap[treeId][nodeId] = { id: nodeId };
    Object.assign(this.treeMap[treeId][nodeId], item);
  },

  updateItems(treeId, items, table) {
    if (!treeId || !table || !items || !items.length) return;   
    items.forEach(item => {
      if (item.id) this.updateItem(treeId, item.id, item);
    });
  },

  deleteItem(treeId, id) {
    if (this.treeMap[treeId] && this.treeMap[treeId][id]) delete this.treeMap[treeId][id];
  },

  deleteItems(treeId, idArray) {
    if (!idArray || !idArray.length) return;
    idArray.forEach(id => {
      this.deleteItem(treeId, id);
    });
  },

  async getBreadcrumbs(treeId, nodeId) {
    const tree_guide = this.treeMap[treeId];
    // console.log('tree_guide='+util.inspect(tree_guide))
    const defComp = descriptor.getTreeDefaultComponents(treeId);
    const breadArr = [];
    let parent = nodeId;
    // console.log('START WHILE parent='+parent)
    while (parent) {
      // console.log('tree_guide[parent]='+util.inspect(tree_guide[parent]))
      if (tree_guide[parent]) {
        breadArr.unshift({ id: parent, title: tree_guide[parent].title, component: getComponent(tree_guide[parent]) });
        if (parent.startsWith('lost_')) {
          parent = '';
        } else {
          parent =  parent != tree_guide[parent].parent ? tree_guide[parent].parent : '';
        }
       
        // parent = tree_guide[parent].parent;
       
      } else parent = '';
      // console.log('IN WHILE parent='+parent)
    }
    return breadArr;

    function getComponent(item) {
      if (!defComp) return '';

      return item.leaf ? defComp.child : defComp.parent;
    }
  },

 getPath(treeId, nodeId, topNodeId) {
    const tree_guide = this.treeMap[treeId];
  if (!tree_guide || !nodeId || !tree_guide[nodeId]) return '';
  if (!tree_guide[nodeId].parent || tree_guide[nodeId].parent == topNodeId) return '';

    const breadArr = [];
    let parent = tree_guide[nodeId].parent;
    while (parent && parent != topNodeId) {
      if (tree_guide[parent]) {
        breadArr.unshift({ id: parent, title: tree_guide[parent].title});
        parent = tree_guide[parent].parent;
      } else parent = '';
    }
    return breadArr.map(item=>item.title).join(' / ');

  }
};
