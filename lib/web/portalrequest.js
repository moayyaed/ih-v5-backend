/**
 *  portalrequset.js
 *  Запросы к порталу шифруются
 */

const util = require('util');

const appconfig = require('../appconfig');
const auth = require('./auth');
const hut = require('../utils/hut');
const nu = require('../utils/netutil');
const appcrypto = require('../utils/appcrypto');

module.exports = function(holder) {
  return async (req, res, next) => {
    // await auth.checkToken(req.headers.token);

    // /portal Уже обрезано // /portal/auth => '/auth'
    const reqPath = req.path;
    const pathArr = reqPath.substr(1).split('/');
    const part1 = pathArr.shift();
    console.log('PORTAL ' + reqPath);

    switch (part1) {
      case 'auth':
        return portalAuth();

      default:
        res.json({ res: 0, message: 'Unknown endpoint ' + reqPath });
    }

    async function portalAuth() {
      const query = req.method == 'GET' ? req.query : req.body;
      let postPath = '';
      console.log('PORTAL query=' + util.inspect(query));
      // Передать запрос на  auth.ih-systems.com/restapi/checkUser или addUser
      try {
        if (query && query.method == 'check') {
          postPath = '/restapi/checkUser';
        } else if (query && query.method == 'register') {
          postPath = '/restapi/addUser';
        } else throw { message: 'Expect query.method "check" or "register" for auth request!' };

        const { login, email, pass } = query;
        const data = { login, email, pass, hwid: appconfig.get('hwid') };

        /*
      const data = JSON.stringify({
        login: 'nimtest',
        email: 'nim@bot.net',
        pass: 'xxxNIMTest1234',
        hwid: appconfig.get('hwid')
      });
      */

        const encData = appcrypto.encryptPublic(JSON.stringify(data));
        let portalResult;

        portalResult = await nu.httpPostRawP({ hostname: 'auth.ih-systems.com', path: postPath }, encData);

        if (!portalResult || portalResult.res == undefined)
          throw { message: 'Missing or invalid portalResult=' + util.inspect(portalResult) };
        if (!portalResult.res) throw { message: portalResult.message || 'Empty response message!' };
        if (!portalResult.data) throw { message: 'Missing data in portal response!' };

        const decData = appcrypto.decrypt(portalResult.data);
        const resObj = JSON.parse(decData);

        if (resObj.status) {
          // Нужно сохранить ответ - userId +  email + login?? + hwid
          return res.json({ res: 1 });
        }

        res.json({ res: 0, message: resObj.message || 'Empty message!' });
      } catch (e) {
        console.log('ERROR: ' + util.inspect(e));
        res.json({ res: 0, message: hut.getShortErrStr(e) });
      }
    }
  };
};
