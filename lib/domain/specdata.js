/**
 * specdata.js
 * 
 */


const appconfig = require('../appconfig');
const portal = require('../domain/portal');


async function getSpecData(query, holder) {
  if (query && query.type == 'xform') {
    return query.id == 'formDashboardUpgrade' ? getformDashboardUpgrade(query, holder) : '';
  }
}

async function getformDashboardUpgrade(query, holder) {
  // Сделать запрос
  let registryState = 'no';
  let portalauth = {};
  let login = '';

  const registry = appconfig.getRegistry();
  if (typeof registry == 'object' && typeof registry.payload == 'object') {
    const resObj = await portal.auth({ hwid: registry.hwid, ...registry.payload }, 'sessioncheck');
    // console.log('INFO: sessioncheck result '+JSON.stringify(resObj));
    if (resObj && resObj.res) {
      registryState = 'OK';
      login = registry.payload.login || '';
    } else {
      portalauth.message = resObj.message;
    }
  }
  return { registryState, portalauth, login };
}

module.exports = {
  getSpecData
};