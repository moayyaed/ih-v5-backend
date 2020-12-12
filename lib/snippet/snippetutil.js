/**
 * sceneutils.js
 */

// const util = require('util');
// const fs = require('fs');

// const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');




function getNewSnippet() {
  return `module.exports = (target, callback) => {
    callback(null, 1);
  };
  `;
}

async function createNewSnippet(id) {
  return fut.writeFileP(appconfig.getSnippetFilename(id), getNewSnippet());
}



function removeScriptFile(id) {
  fut.delFileSync(appconfig.getSnippetFilename(id));
}


module.exports = {

  removeScriptFile,
  createNewSnippet
};
