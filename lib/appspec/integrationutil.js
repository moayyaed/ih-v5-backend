const util = require('util');
const liststore = require('../dbs/liststore');

/**
 * 
 */

async function createIntegrationDoc(id, navnodeid) {
  
    // id=applehome navnodeid=d0335
  const _id = id+'_'+navnodeid;
  const devItem = liststore.getItemFromList('deviceList', navnodeid);
  // console.log('createIntegrationDoc id='+id+' navnodeid='+navnodeid+' devItem'+util.inspect(devItem))

  const Name = devItem ? devItem.name : navnodeid;
  return {
    _id,
    app:id,
    did:navnodeid,
    Name

  }
};

module.exports = {
  createIntegrationDoc
}
