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
      const filter =  req.query;
     
      const recs = await holder.dm.get('lickeys', filter, {order:'name'});   
      // const recs = await holder.dm.findOne('lickeys', filter);
      // const recs = await holder.dm.findRecordById('lickeys', _id);

      res.setHeader('Content-Type', 'application/json');
      const result = JSON.stringify(recs);
      res.send(result);
      debug('<= '+result);
    } catch (err) {
      res.status(400).end('Query error');
      debug('<= 400 Bad Request. Error: ' + JSON.stringify(err));
    }

    /*
    try {
      const record =  req.body;
      if (!record._id)  record._id = shortid.generate();
      await holder.dm.insertDocs('lickeys', [record]); 
      // await holder.dm.upsertDocs('lickeys', [record]); // insert or rewrite with the same _id
      res.send('OK');

      debug('<= OK. insert doc: '+JSON.stringify(record));
    } catch (err) {
      res.status(400).end('Insert error');
      debug('<= 400 Bad Request. Error: ' + JSON.stringify(err));
    }
    */
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