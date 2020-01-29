/**
 *  express_app.js
 */

const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
var favicon = require('serve-favicon');

// Initiate our app
const app = require('express')();

const router = require('./router');

// Configure isProduction variable
// const isProduction = process.env.NODE_ENV === 'production';

// Configure our app
// app.use(cors());
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(require('morgan')('common'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public'))); // ??? Static files from public folder in project
app.use(router);

// Error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  // res.locals.message = err.message;
  // res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500).send({ error: err.message });
});

module.exports = app;
