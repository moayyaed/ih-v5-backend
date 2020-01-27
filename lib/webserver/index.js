/**
 *  webserver
 */

const http = require('http');
const path = require('path');
// const WebSocket = require("ws");

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const errorHandler = require('errorhandler');

// Configure isProduction variable
const isProduction = process.env.NODE_ENV === 'production';

// Initiate our app
const app = express();

app.use(
  session({
    secret: 'passport-tutorial',
    cookie: { maxAge: 60000 },
    resave: false,
    saveUninitialized: false
  })
);

// Configure our app
app.use(cors());
// logs
app.use(require('morgan')('common'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public'))); // Static files from public folder in project

const api = require('./router/api');
const basic = require('./router/basic');

app.use('/api', api);
app.use(basic);

// Error handlers & middlewares
if (!isProduction) {
  app.use(errorHandler());
}

app.use((err, req, res, next) => {
  res.status(err.status || 500);

  res.json({
    errors: {
      message: err.message,
      error: {}
    }
  });
});

// Start server
const port = 3000;
const server = http.createServer(app);
server.keepAliveTimeout = 60000 * 3;

server.listen(port, () => console.log('Server running on http://localhost:' + port));

server.on('error', e => {
  var mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
  console.log(mes);
  process.exit(1);
});

module.exports = app;
// app.listen(8000, () => console.log("Server running on http://localhost:8000/"));
