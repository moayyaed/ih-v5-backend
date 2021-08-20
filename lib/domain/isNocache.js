/**
 * 
 */

const nocache = {
  devicepropswithlinks: 1,
  channelsx:1
};

const nocacheMeta = {
  channellink: 1,
  formLayoutx: 1,
  formCustomtableCommon: 1,
  formSceneScript: 1
};


module.exports = function ({ method, type, id }) {
  if (method == 'getmeta') {
    return nocacheMeta[id];
  }

  return nocache[id] || type == 'subtree';
}