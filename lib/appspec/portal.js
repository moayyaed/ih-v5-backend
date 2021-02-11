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
    console.log('INFO: auth.ih-systems.com req: '+JSON.stringify(data));
    const encData = appcrypto.encryptPublic(JSON.stringify(data));

    const portalResult = await nu.httpPostRawP({ hostname: 'auth.ih-systems.com', path: postPath }, encData);

    if (!portalResult || portalResult.res == undefined)
      throw { message: 'Invalid portalResult=' + util.inspect(portalResult) };
    if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
    if (!portalResult.data) throw { message: 'Missing data in portal response!' };

    const decData = appcrypto.decrypt(portalResult.data);
    const resObj = JSON.parse(decData);

    if (resObj && resObj.status) {
      // Нужно сохранить ответ - userId +  email + login?? + hwid
      // appconfig.setRegistry(resObj);
      return { res: 1, ...resObj };
      // return res.json({ res: 1, ...resObj });
    }

    // res.json({ res: 0, message: resObj.message || 'Empty message!' });
    return { res: 0, message: resObj.message || 'Empty message!' };
  } catch (e) {
    console.log('ERROR: ' + util.inspect(e));
    return { res: 0, message: hut.getShortErrStr(e) };
    // res.json({ res: 0, message: hut.getShortErrStr(e) });
  }
}

module.exports = {
  auth
};
