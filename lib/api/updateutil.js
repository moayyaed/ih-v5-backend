/**
 *  updateutil.js
 */

// const util = require('util');


const descriptor = require('../descriptor');
const treeguide = require('./treeguide');



function addToTreeguide(table, items) {
  if (!table || !items || !items.length) return;

  const trees = descriptor.getTreesForTable(table);
  if (trees) trees.forEach(treeId => treeguide.addItems(treeId, items, table));
}

function updateTreeguide(table, items) {
  if (!table || !items || !items.length) return;

  const trees = descriptor.getTreesForTable(table);
  if (trees) trees.forEach(treeId => treeguide.updateItems(treeId, items, table));
}

// Удалить из treeguide по списку документов
function deleteFromTreeguide(table, docs) {
  if (!table || !docs || !docs.length) return;

  const trees = descriptor.getTreesForTable(table);
  const idArray = docs.map(doc => doc._id);
  if (trees) trees.forEach(treeId => treeguide.deleteItems(treeId, idArray));
}

module.exports = {
  addToTreeguide,
  updateTreeguide,
  deleteFromTreeguide
};
