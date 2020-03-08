/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const express = require('express');
const crypto = require('crypto');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

const router = express.Router();
const syspath = appconfig.get('syspath');

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
  const { method, type, id, nodeid } = query;

  if (method == 'auth') return authResult(query);

  if (!type) throw { error: 'ERRGET', message: 'Type not defined for method:get!' };
  checkToken(query, token);

  switch (method) {
    case 'get':
      if (!id) throw { error: 'ERRGET', message: 'Id not defined for method:get!' };
      if (type == 'form' && !nodeid) throw { error: 'ERRGET', message: 'nodeid not defined for method:get&type:form!' };

      return dm.get(type, id, nodeid);

    case 'getmeta':
      return dm.getMeta(type, id, nodeid);
    default:
      throw { error: 'ERRGET', message: 'Unknown method: ' + method };
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

  if (!type) throw { error: 'ERRPOST', message: 'Type not defined for method: ' + method };
  if (!id) throw { error: 'ERRPOST', message: 'Id not defined for method: ' + method };

  switch (method) {
    case 'insert':
      return dm.insert(body);

    case 'copyto':
      return dm.copyTo(body);

    case 'update':
      return dm.update(body);

    case 'remove':
      return dm.remove(body);

    default:
      throw { error: 'ERRPOST', message: 'Unknown method: ' + method };
  }
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
    return fs.readFileSync(syspath + '/frontend/index.html');
  } catch (e) {
    console.log('getIndex ERROR: ' + util.inspect(e));
  }
}

function getBundle() {
  try {
    return fs.readFileSync(syspath + '/frontend/js/bundle-ui.js.gz', 'binary');
  } catch (e) {
    console.log('getBundle ERROR: ' + util.inspect(e));
  }
}
dm.on('getting', txt => {
  console.log('getting emited: ' + txt);
});

module.exports = router;
