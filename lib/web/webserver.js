/**
 * webserver.js
 */

// const util = require('util');

const http = require('http');
const express = require('./express_app');

const wsserver = require('./wsserver');


exports.start = function(holder) {
  // Start server
  const port = 3000;
  const server = http.createServer(express);
  server.keepAliveTimeout = 60000 * 3;

  server.listen(port, () => console.log('Server running on http://localhost:' + port));

  server.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
    console.log(mes);
    process.exit(1);
  });

  holder.on('finish', () => {
    console.log('Webserver finishing...');
  });

  wsserver.start(server, holder);

}

/*
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = http.createServer(app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);


function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}


function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}


function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
*/

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
