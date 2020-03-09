/**
 *
 */

// const util = require('util');

const descriptor = require('../dbs/descriptor');

module.exports = {
  start() {
    this.treeMap = {};
  },

  get(treeId) {
    return this.treeMap[treeId];
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
    return tree_guide;
  },

  addItem(treeId, nodeId, item) {
    if (!this.treeMap[treeId]) this.treeMap[treeId] = {};
    this.treeMap[treeId][nodeId] = item;
  },

  updateItem(treeId, nodeId, item) {
    if (!this.treeMap[treeId]) this.treeMap[treeId] = {};
    if (!this.treeMap[treeId][nodeId]) this.treeMap[treeId][nodeId] = { id: nodeId };
    Object.assign(this.treeMap[treeId][nodeId], item);
  },

  async getBreadcrumbs(treeId, nodeId) {
    const tree_guide = this.treeMap[treeId];

    const defComp = descriptor.getTreeDefaultComponents(treeId);
    const breadArr = [];
    let parent = nodeId;
    while (parent) {
      if (tree_guide[parent]) {
        breadArr.unshift({ id: parent, title: tree_guide[parent].title, component: getComponent(tree_guide[parent]) });
        parent = tree_guide[parent].parent;
      } else parent = '';
    }
    return breadArr;

    function getComponent(item) {
      if (!defComp) return '';

      return item.leaf ? defComp.child : defComp.parent;
    }
  }
};
