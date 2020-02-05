// const util = require('util');

function makeTree(data) {
  // create the index
  const temp = {};
  data.forEach(item => {
    item.children = [];
    temp[item.id] = item;
  });

  // Create the tree
  const o = [];
  data.forEach(item => {
    // This parent should be in the index
    if (temp[item.parent]) {
      // This row is a child
      // Add the child to the parent
      temp[item.parent].children.push(item);
    } else o.push(item); // Add a root item
  });
  //

  o.forEach(item => process(item));
  return o;
}

function process(item) {
  item.title = item.name;
  delete item.parent;
  delete item.name;
  if (item.children.length > 0) {
    item.children.forEach(citem => process(citem));
  } else delete item.children;
}

function makeTreeWithLeaves(data, leaves) {
  // create data index
  const temp = {};
  data.forEach(item => {
    item.children = [];
    if (!item.order) item.order = 0;
    temp[item.id] = item;
  });

  const leaftemp = {};
  leaves.forEach(item => {
    if (!leaftemp[item.parent]) leaftemp[item.parent] = [];
    if (!item.order) item.order = 0;
    leaftemp[item.parent].push(item);
    delete item.parent;
  });

  // Create the tree
  const tree = [];
  data.forEach(item => {
    if (leaftemp[item.id] && leaftemp[item.id].length >0) {
      for (let i=0; i< leaftemp[item.id].length; i++) {
        addItemByOrder(temp[item.id].children, leaftemp[item.id][i]);
      }
      // temp[item.id].children = [...temp[item.id].children, ...leaftemp[item.id]];
    }
    // This parent should be in the index
    if (temp[item.parent]) {
      // Нужно включить в порядке общей сортировки
      addItemByOrder(temp[item.parent].children, item)
      // temp[item.parent].children.push(item);

      delete item.parent;
      delete item.list;
    } else tree.push(item); // Add a root item
  });

  return tree;
}

function addItemByOrder(arr, item) {
  const len = arr.length;
  if (arr.length <=0 || (arr[len-1].order < item.order)) return arr.push(item);
  let i = len-1;
  while ((i>0) && (arr[i].order < item.order)) {
    i--;
  }  
  arr.splice(i,0,item);
}


/**
 * Возвращает массив элементов, являющихся потомками
 * @param {Object} tree - поддерево с одним корнем, вложенные массивы children
 * @retuen {Array of Objects}
 *
 */

function findAllDescendants(treeObj) {
  const resut = [];
  traverse(treeObj);
  return resut;

  function traverse(tobj) {
    if (!tobj.children || !tobj.children.length) return;
    tobj.children.forEach(child => {
      resut.push(child);
      traverse(child);
    });
  }
}

function findNodeById(tobj, id) {
  if (tobj.id == id) return tobj;

  if (!tobj.children) return; // Не нашли
  for (let i = 0; i < tobj.children.length; i++) {
    const res = findNodeById(tobj.children[i], id);
    if (res) return res;
  }
}

module.exports = {
  findNodeById,
  findAllDescendants,
  makeTree,
  makeTreeWithLeaves
};
