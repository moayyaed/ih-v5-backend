// const util = require('util');

const arr = [
  { id: 123, parent: 0, title: 'Мой дом' },
  { id: 456, parent: 123, title: '1 этаж' },
  { id: 214, parent: 456, title: 'Холл' },
  { id: 810, parent: 456, title: 'Кухня' },
  { id: 457, parent: 123, title: '2 этаж' },
  { id: 458, parent: 123, title: 'Мансарда' },
  { id: 919, parent: 456, title: 'Гостиная' },
  { id: 920, parent: 457, title: 'Спальня' },
  { id: 921, parent: 457, title: 'Детская' },
  { id: 922, parent: 457, title: 'Каминная' },
  { id: 923, parent: 457, title: 'Душевая' }
];

const devs = [
  { id: 'LAMP1', parent: 214, title: 'Лампа в холле'},
  { id: 'LAMP2', parent: 810, title: 'Лампа на кухне' }
];

module.exports = function() {
  return makeTreeWithLeaves(arr, devs);
};

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
    temp[item.id] = item;
  });

  const leaftemp = {};
  leaves.forEach(item => {
    if (!leaftemp[item.parent]) leaftemp[item.parent] = [];
    leaftemp[item.parent].push({ id: item.id, title: item.title, component:'table' });
  });

  // Create the tree
  const o = [];
  data.forEach(item => {
    if (leaftemp[item.id]) {
      temp[item.id].children = [...temp[item.id].children, ...leaftemp[item.id]];
    }
    // This parent should be in the index
    if (temp[item.parent]) {
      temp[item.parent].children.push(item);
    } else o.push(item); // Add a root item
  });

  return o;
}
