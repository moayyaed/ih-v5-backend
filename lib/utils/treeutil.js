// const util = require('util');

/**
 * 
 * @param {Object} desc : {
      branch:{propmap:{_id:'id', name:'title', parent:'parent'}},
      leaf:{propmap:{_id:'id', name:'title', parent:'level'}, propext:{component:'table'}}
    }
 * @param {Array of Arrays} dataArr 
 * @return {Array} - tree
 */

function buildTreeWithLeaves(desc, dataArr) {
  const b_array = transformForTree(dataArr[0], desc.branch);
  const l_array = transformForTree(dataArr[1], desc.leaf);
  return makeTreeWithLeaves(b_array, l_array);
}

/**
 *
 * @param {Array} data
 * @param {Object} descItem
 * @return {Array} - transformed data array
 */
function transformForTree(data, { propmap, propext }) {
  return data.map(item => Object.assign({ id: '', title: '', parent:0 }, getMappedObj(item, propmap), propext));
}

function getMappedObj(obj, propmap) {
  const resobj = {};

  Object.keys(obj).forEach(prop => {
    if (propmap[prop] != undefined) resobj[propmap[prop]] = obj[prop];
  });
  return resobj;
}

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
    leaftemp[item.parent].push({ id: item.id, title: item.title, component: 'table' });
    // leaftemp[item.parent].push(item);
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

module.exports = {
  transformForTree,
  buildTreeWithLeaves,
  makeTree,
  makeTreeWithLeaves
};
