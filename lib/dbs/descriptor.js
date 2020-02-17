/**
 * descriptor.js
 * Компонент для работы с объектом, описывающим данные
 */

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

  getCacheKey(type, id) {
    return `${type}_${id}`;
  },

  getMetaCacheKey(type, id) {
    return `meta#${type}_${id}`;
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
