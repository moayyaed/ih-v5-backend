/**
 *  webserver
 */

const http = require('http');
const path = require('path');
// const os = require('os');

// const WebSocket = require("ws");

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const errorHandler = require('errorhandler');

// Configure isProduction variable
const isProduction = process.env.NODE_ENV === 'production';

// console.log(os.networkInterfaces());

// Initiate our app
const app = express();


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


// WITH HTTPS:
// const https = require("https"),
//  fs = require("fs");

// const options = {
//  key: fs.readFileSync("/srv/www/keys/my-site-key.pem"),
//  cert: fs.readFileSync("/srv/www/keys/chain.pem")
// };

// const app = express();
// app.listen(8000);
// https.createServer(options, app).listen(8080);
