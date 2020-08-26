/**
 *   router.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');
const express = require('express');
// const crypto = require('crypto');

const appconfig = require('../appconfig');

const router = express.Router();

const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/
// const projectpath = appconfig.get('projectpath'); // /opt/intrahouse-d/<>/backend/lib/web/
// const imagePath = appconfig.get('projectpath')+'/images/';

console.log('ROUTER syspath = ' + syspath);

// router.use('/static/', express.static(`${syspath}/frontend/admin/static`));
// router.use('/static/', express.static(`${syspath}/frontend/user/static`));

// router.use('/images/', express.static(`${projectpath}/images/`));

/*
router.get('/test', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(getTest(req.url));
});
*/
/*
router.get('/images/images/', (req, res) => {
  const imagePath = appconfig.get('projectpath')+'/images/';
  const file = imagePath+'/plan2.png';
  console.log('EXPRESS sendFile ' +file);
 
   res.sendFile(file);
 });
*/

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

function getTest(url) {
  try {
   
    return fs.readFileSync(syspath + '/frontend/test.html');
  } catch (e) {
    console.log('getIndex ERROR: ' + util.inspect(e));
  }
}

// Изображения
// Общие??
// router.use('/images/', express.static(`${SYS_PATH}/frontend/images`));

// Локализуемые 
// router.use('/lang/images/', express.static(`${LANG_PATH}/images`));
// router.use('/pm/lang/images/', express.static(`${LANG_PATH}/images`));

// Из проекта
/*
router.get('/images/:file.:ext', (req, res, next) => {
  if (req.params.ext === 'svg' && req.query.color && !(req.query.color === 'transparent' && req.query.stroke === 'transparent')) {
    fs.readFile(`${projectpath}/images/${req.params.file}.svg`, 'binary', (err, file) => {
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
*/
// router.use('/images/', express.static(`${projectpath}/images/`));
// router.use('/images/', express.static(appconfig.get('temppath')+'/snapshot'));




module.exports = router;
