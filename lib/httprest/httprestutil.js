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
  module.exports = async (req, res, holder, debug) => { 
    try {
      const filter =  req.query;
      const data = await holder.dm.get('mytable', filter, {order:'name'});   
      res.json({ res: 1, data });
      debug(JSON.stringify({ res: 1, data }))
    } catch (e) {
      res.json({ res: 0, message: e.message });
      debug(e.message)
    }
  };
`;
}

async function createNewScript(id) {
  return fut.writeFileP(appconfig.getRestapihandlerFilename(id), getNewScript());
}


function removeScriptFile(id) {
  fut.delFileSync(appconfig.getRestapihandlerFilename(id));
}


module.exports = {

  removeScriptFile,
  createNewScript
};