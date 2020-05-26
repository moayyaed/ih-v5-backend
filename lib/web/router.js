/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/

console.log('ROUTER syspath = ' + syspath);

router.use('/static/', express.static(`${syspath}/frontend/admin/static`));
router.use('/static/', express.static(`${syspath}/frontend/user/static`));

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
  console.log('*/index.html rl='+req.url)
  let folder = 'user';
  if (req.url.startsWith('/admin')) {
    folder = 'admin';
  }
  res.send(getIndex(folder));
});

router.get('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  console.log('/* url='+req.url)
  let folder = 'user';
  if (req.url.startsWith('/admin')) {
    folder = 'admin';
  }
  res.send(getIndex(folder));
});

function getIndex(folder) {
  try {
    return fs.readFileSync(syspath + '/frontend/'+folder+'/index.html');
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
