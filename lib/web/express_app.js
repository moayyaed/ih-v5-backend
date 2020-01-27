/**
 *  express_app.js
 */

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initiate our app
const app = require('express')();

// Configure isProduction variable
// const isProduction = process.env.NODE_ENV === 'production';

// Configure our app
app.use(cors());
// logs
app.use(require('morgan')('common'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public'))); // Static files from public folder in project

// const api = require('./router/api');
// const basic = require('./router/basic');
const router = require('./router');

app.use(router);

// Error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
