/**
 * descriptor.js
 * Компонент для работы с объектом, описывающим данные
 */

const util = require('util');
const hut = require('../utils/hut');

module.exports = {
  start(tree, table, list) {
    this.descObj = { tree, table, list};

   
    // Cоздать propremap из propmap
    if (tree) {
      Object.keys(this.descObj.tree).forEach(name => {
        if (this.isOneTreeDesc(name)) {
          const descItem = this.getTreeDesc(name);
          addPropReMap(descItem.branch);
          addPropReMap(descItem.leaf);
        }
      });
    }
  },

  isOneTreeDesc(name) {
    const treeDesc = this.descObj.tree[name];
    return typeof treeDesc == 'object' && treeDesc.branch;
  },

  getTreeDesc(name) {
    return this.descObj.tree[name];
  },

  getTableDesc(name) {
    return this.descObj.table[name];
  },

  getTableValidator(name) {
    return this.descObj.table[name].validator;
  },

  getTableDefaultRecord(name) {
    console.log('getTableDefaultRecord '+name);
    console.log('this.descObj.table[name].default =  '+ util.inspect(this.descObj.table[name].default));
    return this.descObj.table[name] && this.descObj.table[name].default ? hut.clone(this.descObj.table[name].default) : '';
  },

  getTreeLeafDesc(name) {
    return this.descObj.tree[name].leaf;
  },

  getTreeBranchDesc(name) {
    return this.descObj.tree[name].branch;
  },

  // Построить объект для инвалидации кэша при редактировании таблиц, связанных с деревьями
  getTreeCacheInvalidate() {
    if (!this.descObj.tree) return {};

    const result = {};

    const addItem = (table, id) => {
      if (!table) return;
      if (!result[table]) result[table] = [];
      result[table].push(this.getCacheKey('tree', id));
    };

    Object.keys(this.descObj.tree).forEach(name => {
      if (this.isOneTreeDesc(name)) {
        const descItem = this.getTreeDesc(name);
        addItem(descItem.branch.table, name);
        addItem(descItem.leaf.table, name);
      }
    });
    return result;
  },

  createNonexistentListsRootNodes(found) {
    const result = [];
    Object.keys(this.descObj.table).forEach(table => {
      if (this.descObj.table[table].collection == 'lists' && !found[table]) {
        const name = this.descObj.table[table].defRootTitle || 'All ';
        result.push({ _id: table, list: table, parent: 0, order: 0, name });
      }
    });
    return result;
  },

  getUpdateDesc(body) {
    const { type, id, options } = body;
    let partid = id; // optiond:{root:<id поддерева>
    if (options && options.root) partid = options.root;

    return this.getDescItem(type, partid);
  },

  getDescItem(type, id) {
    return this.descObj[type] && this.descObj[type][id] ? this.descObj[type][id] : '';
  },

  getCacheKey(type, id, meta) {
    return meta ? `meta#${type}_${id}` : `${type}_${id}`;
  }

  
};

// Частные функции
function addPropReMap(obj) {
  if (obj && obj.propmap) {
    obj.propremap = {};
    Object.keys(obj.propmap).forEach(prop => {
      if (typeof obj.propmap[prop] == 'string') obj.propremap[obj.propmap[prop]] = prop;
    });
  }
}
