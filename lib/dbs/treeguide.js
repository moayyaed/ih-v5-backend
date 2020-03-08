/**
 *
 */

const util = require('util');

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
        table: desc.branch.table,
        component: ''
      };
    });
    l_array.forEach(item => {
      tree_guide[item.id] = {
        id: item.id,
        title: item.title,
        parent: item.parent,
        table: desc.leaf.table,
        component: ''
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
    if (!this.treeMap[treeId][nodeId]) this.treeMap[treeId][nodeId] = {id:nodeId};
    Object.assign(this.treeMap[treeId][nodeId], item);
  },

  async getBreadcrumbs(treeId, nodeId) {
    console.log('getBreadcrumbs start treeId='+treeId+' nodeId='+nodeId)
  
    const tree_guide = this.treeMap[treeId];
    console.log('getBreadcrumbs tree_guide='+util.inspect(tree_guide))
    console.log('getBreadcrumbs this.treeMap='+util.inspect(this.treeMap))
    const breadArr = [];
    let parent = nodeId;
    while (parent) {
      if (tree_guide[parent]) {
        // НУЖЕН КОМПОНЕНТ!!
        breadArr.unshift({ id: parent, title: tree_guide[parent].title, component: '' });
        parent = tree_guide[parent].parent;
      } else parent = '';
    }
    return breadArr;
  }
};
