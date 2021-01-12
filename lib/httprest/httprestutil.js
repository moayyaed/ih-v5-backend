/**
 * httprestutil.js
 */

// const util = require('util');
// const fs = require('fs');

// const hut = require('../utils/hut');
const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');




function getNewScript() {
  return `
  const shortid = require('shortid');

  module.exports = async (req, res, holder, debug) => { 
    try {
      const record =  req.query;
      if (!record._id)  record._id = shortid.generate();

      await holder.dm.insertDocs('user', [record]); 
      res.send('OK');

      debug('<= OK. insert doc: '+JSON.stringify(record));
    } catch (e) {
      res.status(400).end('Insert error');
      debug('<= 400 Bad Request. Error: ' + util.inspect(err));
    }
  };
`;
}

async function createNewScript(id) {
  return fut.writeFileP(appconfig.getApihandlerFilename(id), getNewScript());
}



function removeScriptFile(id) {
  fut.delFileSync(appconfig.getApihandlerFilename(id));
}


module.exports = {

  removeScriptFile,
  createNewScript
};