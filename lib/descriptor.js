/**
 * descriptor.js
 * Компонент для работы с объектом, описывающим данные
 */

const util = require('util');

const hut = require('./utils/hut');

module.exports = {
  start(tree, table, list) {
    this.descObj = { tree, table, list };

    // Cоздать propremap из propmap
    if (tree) {
      Object.keys(this.descObj.tree).forEach(name => {
        if (this.isOneTreeDesc(name)) {
          const descItem = this.getTreeDesc(name);
          addPropReMap(descItem.branch);
          addPropReMap(descItem.leaf);
        }
      });

      this.tableTreeLinks = this.createTableTreeLinks();
    }
  },

  setTreeDefaultComponents(allTrees) {
    this.treeDefaultComponents = {};
    for (const maintree in allTrees) {
      for (const tree in allTrees[maintree]) {
        if (tree != 'common') {
          this.treeDefaultComponents[tree] = {};
          if (allTrees[maintree][tree].parent && allTrees[maintree][tree].parent.defaultComponent) {
            this.treeDefaultComponents[tree].parent = allTrees[maintree][tree].parent.defaultComponent;
          }
          if (allTrees[maintree][tree].child && allTrees[maintree][tree].child.defaultComponent) {
            this.treeDefaultComponents[tree].child = allTrees[maintree][tree].child.defaultComponent;
          }
        }
      }
    }
  },

  getTreeDefaultComponents(tree) {
    return this.treeDefaultComponents[tree];
  },

  isOneTreeDesc(name) {
    const treeDesc = this.descObj.tree[name];
    return typeof treeDesc == 'object' && treeDesc.branch;
  },

  getSingeTreesAray() {
    return Object.keys(this.descObj.tree).filter(treeId => this.isOneTreeDesc(treeId));
  },

  getTablesAray() {
    return Object.keys(this.descObj.table);
  },

  getTreeDesc(name) {
    return this.descObj.tree[name];
  },

  addCustomTableDesc(name) {
    this.descObj.table[name] = { store: 'db', collection: name, custom: true };
  },

  getTableDesc(name) {
    return this.descObj.table[name];
  },

  getTableValidator(name) {
    return this.descObj.table[name].validator;
  },

  getTableDefaultRecord(name) {
    return this.descObj.table[name] && this.descObj.table[name].default
      ? hut.clone(this.descObj.table[name].default)
      : '';
  },

  getTreeLeafDesc(name) {
    return this.descObj.tree[name].leaf;
  },

  getTreeBranchDesc(name) {
    return this.descObj.tree[name].branch;
  },

  // Построить объект связи таблица - дерево или для инвалидации кэша при редактировании таблиц, связанных с деревьями
  createTableTreeLinks() {
    if (!this.descObj.tree) return {};

    const result = {};

    const addItem = (table, id) => {
      if (!table) return;
      if (!result[table]) result[table] = [];
      result[table].push(id);
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

  // Построить объект связи таблица - дерево
  // Используется при редактировании формы, чтобы обновить элементы treeguide

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

  createRootNode(table) {
    const result = [];
    const name = this.descObj.table[table].defRootTitle || 'All ';
    result.push({ _id: table, parent: 0, order: 0, name, folder: 1 });
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

  getTreesForTable(table) {
    return this.tableTreeLinks[table];
  },

  getListNames() {
    return this.descObj.list ? Object.keys(this.descObj.list) : [];
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
