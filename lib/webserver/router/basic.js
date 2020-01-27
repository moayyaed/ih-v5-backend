/**
 * basic.js
 */
const util = require("util")
const express = require('express');

const router = express.Router();

// home page route (http://localhost:8080)
router.get('/', (req, res) =>  {
  // const sess =  (req.session) ? util.inspect(req.session) : 'NO';
  // res.send('im the home page! '+sess);  
  res.send("I am IH server");  
});

module.exports = router;