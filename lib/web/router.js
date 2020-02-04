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

// POST /api
router.post('/api', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    check(res, req);
    const dataObj = await processApi(req.body, req.headers.token);
    const result = Object.assign({ response: 1 }, dataObj);

    console.log(JSON.stringify(result));
    res.send(JSON.stringify(result));
  } catch (e) {
    res.send(JSON.stringify({ response: 0, error: e.error, message: e.message }));
  }
});

function check(res, req) {
  console.log('BODY: ' + JSON.stringify(req.body));

  if (!req.body) throw { error: 'ERRPOST', message: 'No body!' };
  if (!req.body.method) throw { error: 'ERRPOST', message: 'No method in body!' };

  if (req.body.method != 'auth' && !req.headers.token) {
    throw { error: 'NEEDAUTH', message: appconfig.getMessage('NEEDAUTH') };
  }
}

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return {Object} data object to send
 */

async function processApi(body, token) {
  const { method, type, id } = body;

  switch (method) {
    case 'auth':
      return authResult(body);

    case 'get':
      if (!type) throw { error: 'ERRPOST', message: 'Type not defined for method:get!' };
      if (!id) throw { error: 'ERRPOST', message: 'Id not defined for method:get!' };

      return dataResult(body, token);

    case 'insert':
        if (!type) throw { error: 'ERRPOST', message: 'Type not defined for method:insert!' };
        if (!id) throw { error: 'ERRPOST', message: 'Id not defined for method:insert!' };
  
        return insertResult(body, token);

    case 'update':
      if (!type) throw { error: 'ERRPOST', message: 'Type not defined for method:update!' };
      if (!id) throw { error: 'ERRPOST', message: 'Id not defined for method:update!' };

      return updateResult(body, token);

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

async function dataResult(body, token) {
  const { type, id } = body;

  // Проверить token!!

  return dm.get(type, id);
}

async function updateResult(body, token) {
  // Проверить token!!

  return dm.update(body);
}

async function insertResult(body, token) {
  // Проверить token!!

  return dm.insert(body);
}

function checkUser(username, password) {
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

module.exports = router;
