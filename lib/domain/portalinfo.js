/**
 *
 */

const util = require('util');
const fs = require('fs');
const appconfig = require('../appconfig');

const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
// const treeutil = require('../utils/treeutil');
const liststore = require('../dbs/liststore');

async function createPortalinfoDoc(id, formId, dm) {
  const res = { _id: id, name: 'New' };
  const mainDoc = await dm.findRecordById('scene', id);
  if (mainDoc) res.name = mainDoc.name;
  // console.log('createPortalinfoDoc id=' + id + ' mainDoc=' + util.inspect(mainDoc) + ' res=' + util.inspect(res));
  return res;
}

module.exports = {
  createPortalinfoDoc
};
