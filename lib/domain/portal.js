/**
 *  Функции запросов к порталу.
 *   Запросы к порталу шифруются
 */
const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const nu = require('../utils/netutil');
const appcrypto = require('../utils/appcrypto');

async function auth(query, method) {
  try {
    const postPath = '/restapi/' + method;
    const data = { ...query, hwid: appconfig.get('hwid') };
    const encData = appcrypto.encryptPublic(JSON.stringify(data));

    const portalResult = await nu.httpPostRawP({ hostname: 'auth.ih-systems.com', path: postPath }, encData);

    if (!portalResult || portalResult.res == undefined)
      throw { message: 'Invalid portalResult=' + util.inspect(portalResult) };
    if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
    if (!portalResult.data) throw { message: 'Missing data in portal response!' };

    const decData = appcrypto.decrypt(portalResult.data);
    const resObj = JSON.parse(decData);

    if (resObj && resObj.status) {
      return { res: 1, ...resObj };
    }
    return { res: 0, message: resObj.message || 'Empty message!' };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { res: 0, message: hut.getShortErrStr(e) };
  }
}


async function activation_license(query) {
  try {
    const postPath = '/restapi/activation_license' ;
    const data = { ...query, hwid: appconfig.get('hwid') };
    console.log('INFO: START activation_license, data='+ util.inspect(data))
    const encData = appcrypto.encryptPublic(JSON.stringify(data));

    console.log('INFO: => /restapi/activation_license, data='+ util.inspect(data))
    const portalResult = await nu.httpPostRawP({ hostname: 'license.ih-systems.com', path: postPath }, encData);

    if (!portalResult || portalResult.res == undefined)
      throw { message: 'Invalid portalResult=' + util.inspect(portalResult) };
    if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
    if (!portalResult.data) throw { message: 'Missing data in portal response!' };

    const decData = appcrypto.decrypt(portalResult.data);
    const resObj = JSON.parse(decData);
    console.log('INFO: <=  portalResult.data='+ util.inspect(resObj))
    if (resObj && resObj.status) {
      return { res: 1, ...resObj };
    }
    return { res: 0, message: resObj.message || 'Empty message!' };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { res: 0, message: hut.getShortErrStr(e) };
  }
}


module.exports = {
  auth,
  activation_license
};
