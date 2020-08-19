/**
 * apirequest.js
 *  middleware for /api
 *
 */

const util = require('util');

const auth = require('./auth');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

const postapi = require('../api/postapi');
const getapi = require('../api/getapi');
const enginereq = require('../api/enginereq');

module.exports = function(holder) {
  return async (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');

    try {
      // /api Уже обрезано /engine/startscene?id=1 || /admin?method=get
      const reqPath = req.path;
      if (reqPath.length < 2) {
        // /api/ => '/'
        return next();
      }

      const pathArr = reqPath.substr(1).split('/');
      console.log(reqPath + ' => ' + util.inspect(pathArr));

      const part1 = pathArr.shift();

      let dataObj;
      switch (part1) {
        case 'admin':
          dataObj = await adminreq(req, holder);
          break;

        case 'engine':
          dataObj = await enginereq(pathArr, req, holder);
          break;

        case 'user':
          dataObj = await userreq(pathArr, req, holder);
          break;
        default:
          throw { message: 'Unknown endpoint ' + reqPath };
      }

      const result = Object.assign({ response: 1 }, dataObj);
      res.send(JSON.stringify(result));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };
};

async function adminreq(req, holder) {
  const token = req.headers.token;
  const query = req.method == 'GET' ? req.query : req.body;

  if (query.method == 'auth') return authResult(query, token);

  checkRequest(query, req);
  if (!query.method) throw { error: 'ERRQUERY', message: 'No method in query!' };

  return req.method == 'GET' ? getApi(query, token, holder) : postApi(query, token, holder);
}

function checkRequest(query, req) {
  if (!query) throw { error: 'ERRQUERY', message: 'No query!' };

  if (query.method != 'auth' && !req.headers.token) {
    throw { error: 'NEEDAUTH', message: appconfig.getMessage('NEEDAUTH') };
  }
}

async function userreq(req, holder) {
  const token = req.headers.token;
  const query = req.method == 'GET' ? req.query : req.body;

  if (query.method == 'auth') return authResult(query, req);

  checkRequest(query, req);
  return req.method == 'GET' ? getApi(query, token, holder) : postApi(query, token, holder);
}

/**
 *
 * @param {Object} query
 * @param {String} token
 * @return {Object} data object to send
 */
async function getApi(query, token, holder) {
  const { method, type } = query;
  if (method == 'auth') return authResult(query, token);

  const res = await auth.getUserByToken(token);
  if (!res || !res.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

  if (!type) throw { error: 'ERRQUERY', message: 'Type not defined: ' + JSON.stringify(query) };

  const data = dm.getFromCache(query); // Попытка считать из кэша без await
  return typeof data == 'object' ? data : getapi.get(query, holder);
}

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return {Object} data object to send
 */
async function postApi(body, token, holder) {
  const { method, type, id } = body;
  if (method == 'auth') return authResult(body, token);

  const res = await auth.getUserByToken(token);
  if (!res || !res.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

  if (!method) throw { error: 'SORTERR', message: 'Method not defined for request!' };
  if (!type) throw { error: 'SORTERR', message: 'Type not defined for request!' };
  if (!id) throw { error: 'SORTERR', message: 'Id not defined for request!' };

  const apiFun = postapi[type][method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unknown type or method!' };
  return apiFun(body, holder);
}

async function authResult({ username, password }, token) {
  const res = {};
  let user;
  if (username && password) {
    user = await auth.getUserByLogin(username, password);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };

    res.token = auth.createNewToken(username);
  } else if (token) {
    user = await auth.getUserByToken(token);
    if (!user) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

  } else {
    if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
    if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
  }
  return { ...res, ...getUserData(user) };
}

function getUserData(user) {
  return { layout: user.mainlay, name: user.name };
}

/*
async function checkToken(token) {
  return auth.getUserByToken(token);

}
*/
