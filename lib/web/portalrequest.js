/**
 *  portalrequset.js
 *  middleware for /portal
 *  
 */

// const util = require('util');

const appconfig = require('../appconfig');
const portal = require('../appspec/portal');

module.exports = function(holder) {
  return async (req, res, next) => {
    // await auth.checkToken(req.headers.token);
    const query = req.method == 'GET' ? req.query : req.body;

    // /portal Уже обрезано // /portal/auth/signin => '/auth/signin'
    const reqPath = req.path;
    if (req.path) {
      const pathArr = reqPath.substr(1).split('/');
      if (pathArr && pathArr.length > 1) {
        if (pathArr[0] == 'auth') return portalAuth(pathArr[1]);
      }
    }

    res.json({ res: 0, message: 'Unknown endpoint ' + reqPath });

    // method = signin || signup || confirm
    async function portalAuth( method) {
      const result = portal.auth(query, method);  // { res: 1, ...resObj }; || { res: 0, message: hut.getShortErrStr(e) }
      if (result && result.status) {
        appconfig.setRegistry(result);
      }
      res.json(result);
    }

    /*
    async function portalAuth( method) {
      
      const postPath = '/restapi/' + method;

      console.log('PORTAL query=' + util.inspect(query));
      // Передать запрос на  auth.ih-systems.com/restapi/checkUser или addUser
      try {
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
          // Нужно сохранить ответ - userId +  email + login?? + hwid
          appconfig.setRegistry(resObj);
          return res.json({ res: 1, ...resObj });
        }

        res.json({ res: 0, message: resObj.message || 'Empty message!' });
      } catch (e) {
        console.log('ERROR: ' + util.inspect(e));
        res.json({ res: 0, message: hut.getShortErrStr(e) });
      }
    }
    */
  };
};
