/**
 *  portalrequset.js
 * 
 *  Middleware for /portal
 *
 */

// const util = require('util');

const appconfig = require('../appconfig');
const portal = require('../domain/portal');

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
    async function portalAuth(method) {
      const result = await portal.auth(query, method); // { res: 1, ...resObj }; || { res: 0, message: hut.getShortErrStr(e) }
    
      if (result && result.status) {
        appconfig.setRegistry(result);
      }
      res.json(result);
    }
  };
};
