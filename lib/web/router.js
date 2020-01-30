/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const express = require('express');
const crypto = require('crypto');

const appconfig = require('../utils/appconfig');
const dyndata = require('../dbs/dyndata');
const tree = require('../dbs/tree');

const router = express.Router();
const syspath = appconfig.get('syspath');

// Static
router.use('/images/', express.static(`${syspath}/frontend/images`));

// POST /api
router.post('/api', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  try {
    console.log('BODY: ' + JSON.stringify(req.body));

    if (!req.body) throw { error: 'ERRPOST', message: 'No body!' };
    if (!req.body.method) throw { error: 'ERRPOST', message: 'No method in body!' };

    if (req.body.method != 'auth' && !req.headers.token) {
      throw { error: 'NEEDAUTH', message: appconfig.getMessage('NEEDAUTH')};
    }
  } catch (e) {
    res.send(JSON.stringify({ response: 0, error: e.error, message: e.message }));
    return;
  }

  let result;
  processApi(req.body, req.headers.token)
    .then(dataObj => {
      result = Object.assign({ response: 1 }, dataObj);
    })
    .catch(e => {
      result = Object.assign({ response: 0 }, e);
    })
    .finally(() => {
      console.log(JSON.stringify(result));
      res.send(JSON.stringify(result));
    });
});

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return <Promise> {Object}
 */
function processApi(body, token) {
  const { method, type, id } = body;

  try {
    switch (method) {
      case 'auth':
        return authResult(body);

      case 'data':
        if (!type) throw { error: 'ERRPOST', message: 'Type not defined for method:data!' };
        if (!id) throw { error: 'ERRPOST', message: 'Id not defined for method:data!' };

        return dataResult(body, token);
      default:
        throw { error: 'ERRPOST', message: 'Unknown method: ' + method };
    }
  } catch (e) {
    return Promise.reject(e);
  }
}

function authResult({ username, password }) {
  try {
    if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
    if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
    if (!checkUser(username, password))
      throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
    return Promise.resolve({ token: getNewToken(username) });
  } catch (e) {
    return Promise.reject(e);
  }
}

function dataResult(body, token) {
  const { type, id } = body;

  switch (type) {
    case 'tree':
      return id == 'devices' ? Promise.resolve({ data: tree(body) }) : Promise.resolve({ data: tree2(body) });

    case 'menu':
      return dyndata.get(type, id);
    default:
      return Promise.resolve({ data: [] });
  }
}

function tree2() {
  return [
    { id: 1, parent: 0, title: 'Экраны' },
    { id: 2, parent: 0, title: 'Шаблоны' }
  ];
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
