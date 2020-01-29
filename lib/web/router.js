/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');

const tree = require('../dbs/tree');

const appdir = path.resolve(process.cwd());
const syspath = path.join(appdir, '..');
console.log('appdir=' + appdir + '  syspath= ' + syspath);

const router = express.Router();

// Общие
router.use('/images/', express.static(`${syspath}/frontend/images`));

router.post('/api', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  let result;
  try {
    console.log('BODY: '+JSON.stringify(req.body));

    if (!req.body) throw { error: 'ERRPOST', message: 'No body!' };
    if (!req.body.method) throw { error: 'ERRPOST', message: 'No method in body!' };
    const method = req.body.method;
    const token = req.headers.token;

    if (method == 'auth') {
      result = authResult(req.body);
    } else {
      if (!token) throw { error: 'NEEDAUTH', message: 'Token not found.' };
      if (method == 'data') {
        if (!req.body.type) throw { error: 'ERRPOST', message: 'No type for method=data in body!' };
        if (req.body.type == 'tree') {
          if (req.body.id == 'devices') {
            result = { response: 1, data: tree(req.body) };
          } else {
            result = { response: 1, data: tree2(req.body) };
          }
        } else if (req.body.type == 'menu') {
          result = { response: 1, data: menuResult(req.body) };
        } else throw { error: 'ERRPOST', message: 'Invalid type for method=data in body!' };
      }
    }
  } catch (e) {
    result = { response: 0, error: e.error, message: e.message };
  }
  console.log('=> '+JSON.stringify(result))
  res.send(JSON.stringify(result));
});

function tree2() {
  return [
    {"id":1,"parent":0,"title":"Экраны"},
    {"id":2,"parent":0,"title":"Шаблоны"}
  ];
}

function authResult({ username, password }) {
  if (!username) throw { error: 'ERRAUTH', message: 'No username, authentication failed!' };
  if (!password) throw { error: 'ERRAUTH', message: 'Empty password, authentication failed!' };
  if (!checkUser(username, password))
    throw { error: 'ERRAUTH', message: 'Insufficient password, authentication failed!' };

  return { response: 1, token: getNewToken(username) };
}

function menuResult(body) {
  return [
    { id: '1', route: 'devices', title: 'Устройства', tooltip: 'Устройства', icon: '' },
    { id: '2', route: 'visualization', title: 'Визуализация', tooltip: 'Визуализация', icon: '' },
    { id: '3', route: 'scripts', title: 'Сценарии', tooltip: 'Сценарии', icon: '' },
    { id: '4', route: 'datasource', title: 'Источники данных', tooltip: 'Источники данных', icon: '' },
    { id: '6', route: 'analytics', title: 'Аналитика', tooltip: 'Аналитика', icon: '' },
    { id: '7', route: 'access', title: 'Доступ', tooltip: 'Доступ', icon: '' },
    { id: '8', route: 'database', title: 'База данных', tooltip: 'База данных', icon: '' },
    { id: '9', route: 'resources', title: 'Ресурсы', tooltip: 'Ресурсы', icon: '' }
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

/*
const appconfig = require('../utils/appconfig');
const lang = require('../utils/lang');
const bhandler = require('./bhandler');
const uploadfiles = require('./uploadfiles');
const downloadfiles = require('./downloadfiles');


const router = express.Router();

const PROJECT_PATH = appconfig.getProjectPath();
const SYS_PATH = appconfig.getSysPath();
const LANG_PATH = lang.getLangPath();

router.post('/uploadfiles', uploadfiles);

router.get('/pm/uploadfiles/images/:file.:ext', (req, res, next) => {
  if (req.params.ext === 'svg' && req.query.color && !(req.query.color === 'transparent' && req.query.stroke === 'transparent')) {
    fs.readFile(`${PROJECT_PATH}/images/${req.params.file}.svg`, 'binary', (err, file) => {
      if (err) {
        next();
      } else {
        res.setHeader('Content-Type', 'image/svg+xml');
        if (req.query.color !== 'transparent' && req.query.stroke !== 'transparent') {
          res.send(
            file
            .replace(/fill="[^]*?"/g, '')
            .replace(/stroke="[^]*?"/g, `stroke="rgba(${req.query.stroke})"`)
            .replace('<svg', `<svg fill="rgba(${req.query.color})"`)
          );
        }
        if (req.query.color !== 'transparent' && req.query.stroke === 'transparent') {
          res.send(
            file
            .replace(/fill="[^]*?"/g, '')
            .replace('<svg', `<svg fill="rgba(${req.query.color})"`)
          );
        }
        if (req.query.stroke !== 'transparent' && req.query.color === 'transparent') {
          res.send(
            file
            .replace(/stroke="[^]*?"/g, `stroke="rgba(${req.query.stroke})"`)
          );
        }
      }
    });
  } else {
    next();
  }
});

router.get('/uploadfiles/images/:file.:ext', (req, res, next) => {
  if (req.params.ext === 'svg' && req.query.color && !(req.query.color === 'transparent' && req.query.stroke === 'transparent')) {
    fs.readFile(`${PROJECT_PATH}/images/${req.params.file}.svg`, 'binary', (err, file) => {
      if (err) {
        next();
      } else {
        res.setHeader('Content-Type', 'image/svg+xml');
        if (req.query.color !== 'transparent' && req.query.stroke !== 'transparent') {
          res.send(
            file
            .replace(/fill="[^]*?"/g, '')
            .replace(/stroke="[^]*?"/g, `stroke="rgba(${req.query.stroke})"`)
            .replace('<svg', `<svg fill="rgba(${req.query.color})"`)
          );
        }
        if (req.query.color !== 'transparent' && req.query.stroke === 'transparent') {
          res.send(
            file
            .replace(/fill="[^]*?"/g, '')
            .replace('<svg', `<svg fill="rgba(${req.query.color})"`)
          );
        }
        if (req.query.stroke !== 'transparent' && req.query.color === 'transparent') {
          res.send(
            file
            .replace(/stroke="[^]*?"/g, `stroke="rgba(${req.query.stroke})"`)
          );
        }
      }
    });
  } else {
    next();
  }
});

// Общие 
router.use('/images/', express.static(`${SYS_PATH}/frontend/images`));
router.use('/pm/images/', express.static(`${SYS_PATH}/frontend/images`));

// Локализуемые 
router.use('/lang/images/', express.static(`${LANG_PATH}/images`));
router.use('/pm/lang/images/', express.static(`${LANG_PATH}/images`));

router.use('/uploadfiles/images/', express.static(`${PROJECT_PATH}/images/`));
router.use('/pm/uploadfiles/images/', express.static(`${PROJECT_PATH}/images/`));

router.get('/index.html', (req, res) => {
  res.send( bhandler.getIndex());
});

router.get('/', (req, res) => {
  res.send( bhandler.getIndex());
});

router.get('/pm/index.html', (req, res) => {
  res.send( bhandler.getIndex('pm'));
});

router.get('/pm/', (req, res) => {
  res.send( bhandler.getIndex('pm'));
});

router.get('/pm', (req, res) => {
  res.send(bhandler.getIndex('pm'));
});

router.use('/public/', express.static(`${SYS_PATH}/public/`));

router.use('/download/:type/:folder', downloadfiles);
  

router.get('/js/bundle.js.gz', (req, res) => {
  const binary = bhandler.getBundle();
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


router.get('/pm/js/bundle.js.gz', (req, res) => {
  const binary = bhandler.getBundle('pm');
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
*/

module.exports = router;
