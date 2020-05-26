/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const express = require('express');
// const crypto = require('crypto');

const router = express.Router();

const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/

console.log('ROUTER syspath = ' + syspath);

router.use('/static/', express.static(`${syspath}/frontend/admin/static`));
router.use('/static/', express.static(`${syspath}/frontend/user/static`));

router.get('*/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getIndex(req.url));
});

router.get('/*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getIndex(req.url));
});

function getIndex(url) {
  try {
    let folder = 'user';
    if (url && url.startsWith('/admin')) {
      folder = 'admin';
    }
    return fs.readFileSync(syspath + '/frontend/'+folder+'/index.html');
  } catch (e) {
    console.log('getIndex ERROR: ' + util.inspect(e));
  }
}

/*
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

function getBundle() {
  try {
    return fs.readFileSync(syspath + '/frontend/js/bundle-ui.js.gz', 'binary');
  } catch (e) {
    console.log('getBundle ERROR: ' + util.inspect(e));
  }
}
*/


module.exports = router;
