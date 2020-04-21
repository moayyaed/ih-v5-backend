/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const express = require('express');
const crypto = require('crypto');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

const postapi = require('../api/postapi');
const getapi = require('../api/getapi');
const linkmethods = require('../api/linkmethods');

const router = express.Router();
const syspath = appconfig.get('syspath');
// const syspath = '/opt/intrahouse-d';

// Static
router.use('/static/', express.static(`${syspath}/frontend/static`));

// get /api
router.get('/api/admin', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    checkGet(res, req);
    const dataObj = await processGetApi(req.query, req.headers.token);
    const result = Object.assign({ response: 1 }, dataObj);
    res.send(JSON.stringify(result));
  } catch (e) {
    console.log('CATCH error' + util.inspect(e));
    res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
  }
});

// POST /api
router.post('/api/admin', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    checkPost(res, req);
    const dataObj = await processPostApi(req.body, req.headers.token);
    console.log('router.post '+util.inspect(dataObj))
    const result = Object.assign({ response: 1 }, dataObj);
    res.send(JSON.stringify(result));
  } catch (e) {
    console.log('CATCH error' + util.inspect(e));
    res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
  }
});

function checkPost(res, req) {
  console.log('BODY: ' + JSON.stringify(req.body));

  if (!req.body) throw { error: 'ERRPOST', message: 'No body!' };
  if (!req.body.method) throw { error: 'ERRPOST', message: 'No method in body!' };

  if (req.body.method != 'auth' && !req.headers.token) {
    throw { error: 'NEEDAUTH', message: appconfig.getMessage('NEEDAUTH') };
  }
}

function checkGet(res, req) {
  console.log('Query: ' + JSON.stringify(req.query));

  if (!req.query) throw { error: 'ERRGET', message: 'No query!' };
  if (!req.query.method) throw { error: 'ERRGET', message: 'No method in query!' };

  if (req.query.method != 'auth' && !req.headers.token) {
    throw { error: 'NEEDAUTH', message: appconfig.getMessage('NEEDAUTH') };
  }
}
/**
 *
 * @param {Object} query
 * @param {String} token
 * @return {Object} data object to send
 */
async function processGetApi(query, token) {
  const spec = ["link"];

  const { method, type, id, nodeid } = query;

  if (method == 'auth') return authResult(query);

  if (!type) throw { error: 'ERRGET', message: 'Type not defined for method:get!' };
  checkToken(query, token);

  const data = dm.getFromCache(query); // Без await для get&getmeta
  if (data) return data;

  switch (method) {
    case 'get':
      if (!id) throw { error: 'ERRGET', message: 'Id not defined for method:get!' };
      if (type == 'form' && !nodeid) throw { error: 'ERRGET', message: 'nodeid not defined for method:get&type:form!' };
  
      return spec.includes(type) ? getByQuery(query) : getapi.get(query);

    case 'getmeta':
      return getapi.get(query);
    
    case 'clear':
      return postapi.link.clear(query); 

    default:
      throw { error: 'ERRGET', message: 'Unknown method: ' + method };
  }
}

/**
 *  Получение данных по запросу, запрос может содержать данные, специфичные для типа
 *  Это динамические данные, результат в кэше не сохраняется
 *
 * @param {Object} query - объект запроса
 * @return {Object}: {data}
 */
async function getByQuery(query) {
  switch (query.type) {
    // type=link'&id=devicelink&nodeid=xxxx&anchor=modbus1.ch_1
    case 'link':
      return linkmethods.get(query);
    default:
      throw { error: 'SOFTERR', message: 'Unexpected type: ' + query.type };
  }
}

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return {Object} data object to send
 */
async function processPostApi(body, token) {
  const { method, type, id } = body;

  if (method == 'auth') return authResult(body);

  checkToken(body, token);

  if (!method) throw { error: 'SORTERR', message: 'Method not defined for request!'  };
  if (!type) throw { error: 'SORTERR', message: 'Type not defined for request!' };
  if (!id) throw { error: 'SORTERR', message: 'Id not defined for request!'  };
  
  const apiFun = postapi[type][method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unknown type or method!'  };
  return apiFun(body);
}

async function authResult({ username, password }) {
  if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
  if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
  if (!checkUser(username, password)) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
  // TODO Проверить, формировать
  return { token: getNewToken(username) };
}

function checkUser(username, password) {
  console.log(password);
  return true;
}

function checkToken(query, token) {
  console.log(token);
  return true;
}

function getNewToken(username) {
  return '12345_' + username;
}

router.get('/js/bundle.js.gz', (req, res) => {
  const binary = getBundle();
  const retag = req.get('If-None-Match');
  const etag = crypto
    .createHash('md5')
    .update(binary)
    .digest('hex');

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Disposition', 'gzip');
  res.setHeader('Etag', etag);

  if (retag === etag) {
    res.status(304).end(binary, 'binary');
  }
  res.end(binary, 'binary');
});

router.get('*/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getIndex());
});

router.get('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getIndex());
});

function getIndex() {
  try {
    return fs.readFileSync(appconfig.get('syspath') + '/frontend/index.html');
  } catch (e) {
    console.log('getIndex ERROR: ' + util.inspect(e));
  }
}

function getBundle() {
  try {

    return fs.readFileSync(appconfig.get('syspath') + '/frontend/js/bundle-ui.js.gz', 'binary');
  } catch (e) {
    console.log('getBundle ERROR: ' + util.inspect(e));
  }
}


module.exports = router;

/*
/api/admin?type=components&method=getmeta

/api/admin?type=menu&id=pmmenu&method=get

/api/admin?type=tree&id=dev&method=getmeta
/api/admin?type=tree&id=dev&method=get

/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=getmeta
/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=get

/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=getmeta
/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=get
*/
