/**
 * apirequest.js
 *  middleware for /api:
 *    /api/admin?
 *    /api/user?
 *    /api/engine
 */

const util = require('util');

const auth = require('./auth');

const appconfig = require('../appconfig'); // Получение текстов сообщений
const dm = require('../datamanager'); // Чтение данных из кэша

const postapi = require('../api/postapi');
const getapi = require('../api/getapi');
const enginereq = require('../api/enginereq');
const importexport = require('../utils/importexport');

module.exports = function(holder) {
  return async (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');

    // /api Уже обрезано /engine/startscene?id=1 || /admin?method=get
    const reqPath = req.path;
    if (reqPath.length < 2) return next(); // /api/ => '/'

    const pathArr = reqPath.substr(1).split('/');
    const part1 = pathArr.shift();
    const token = req.headers.token;
    const query = req.method == 'GET' ? req.query : req.body;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };

      // const dataObj = query.method == 'auth' ? await authResult(query, token) : await getDataObj(part1);
      const dataObj = query.method == 'auth' ? await authResult(query, req.headers) : await getDataObj(part1);

      //
      const result = Object.assign({ response: 1 }, dataObj);
      res.send(JSON.stringify(result));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }

    async function getDataObj(part) {
      const user = await auth.getUserByToken(token);
      if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

      // TODO - здесь проверить права доступа!!!
      if (req.method != 'GET' && auth.isGuest(user)) throw {  message: 'Операция не разрешена!' };


        switch (part) {
          case 'admin':
            if (!auth.adminAccessAllowed(user, query)) throw {  message: 'Доступ не разрешен!' };
            return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);

          case 'user':
            return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);

          case 'engine':
            return enginereq(pathArr, req, user, holder);

          case 'export':
       
            return importexport.exportPack({templates:[{id:query.id}]});

          default:
            throw { message: 'Unknown endpoint ' + reqPath };
        }
    }
  };
};


/**
 *
 * @param {Object} query
 * @param {String} token
 * @return {Object} data object to send
 */
async function getApi(query, user, holder) {
  if (!query.type) throw { error: 'ERRQUERY', message: 'Type not defined: ' + JSON.stringify(query) };

  const data = dm.getFromCache(query); // Попытка считать из кэша без await
  return typeof data == 'object' ? data : getapi.get(query, user, holder);
}

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return {Object} data object to send
 */
async function postApi(body, token, holder) {
  const { method, type, id } = body;

  if (!method) throw { error: 'SORTERR', message: 'Method not defined for request!' };
  if (!type) throw { error: 'SORTERR', message: 'Type not defined for request!' };
  if (!id) throw { error: 'SORTERR', message: 'Id not defined for request!' };

  const apiFun = postapi[type][method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unknown type or method!' };
  return apiFun(body, holder);
}

async function authResult(query, headers) {
  const res = {};
  // const {username, password, token} = headers;
  const { username, password } = query;
  const token = headers.token;

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
