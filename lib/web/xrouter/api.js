/**
 * api.js
 */

const util = require('util');
const express = require('express');

const jdb = require('../../dbs/jstore');


const router = express.Router();

// /api
router.get('/', (req, res) => {
  const sess = req.session ? util.inspect(req.session) : 'NO';

  res.send('Root API page. Session:  ' + sess);
});

// /api/test
router.get('/test', (req, res) => {
  jdb.test.find({}, (err, docs) => {
    res.send(docs);
  });
});

router.get('/test/:testId', (req, res) => {
  res.send('/api/test id= '+req.params.testId);
});

router.get('/test/*', (req, res) => {
  res.send('Any API page. ');
});

module.exports = router;
