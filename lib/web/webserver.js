/**
 * webserver.js
 */

// const util = require('util');

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const expressFileUpload = require('express-fileupload');
// const cors = require('cors');
const morgan = require('morgan');


const wsserver = require('./wsserver');
const router = require('./router');
const apirequest = require('./apirequest');

const appconfig = require('../appconfig');

const uploadfiles = require('./uploadfiles');


module.exports = async function(holder) {
  const express_app = express();

  // Configure express
  // express_app.use(cors());
  express_app.use(morgan('common'));

  express_app.use(bodyParser.urlencoded({ extended: false }));
  express_app.use(bodyParser.json());

  express_app.use(expressFileUpload());

  // express_app.post('/uploadfiles', uploadfiles);
  express_app.post('/test', uploadfiles);
 

  express_app.use('/api/', apirequest(holder));
  

  // express_app.use(express.static(path.join(__dirname, 'public'))); // ???
  express_app.use(router);

  // Start webserver
  const port = normalizePort(appconfig.get("port") || '3000');

  const server = http.createServer(express_app);
  server.keepAliveTimeout = 60000 * 3;

  server.listen(port, () => console.log('INFO: Webserver has started on http://localhost:' + port));

  server.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
    console.log('ERROR: '+mes);
    process.exit(1);
  });

  holder.on('finish', () => {
    // console.log('Webserver finishing...');
  });

  // Start websocket
  wsserver.start(server, holder);
};

function normalizePort(val) {
  const port = parseInt(val, 10);
  return  (isNaN(port) || port <= 0) ? '' : port;
}


/*
var port = normalizePort(process.env.PORT || '3000');
express_app.set('port', port);

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
// express_app.listen(8000);
// https.createServer(options, app).listen(8080);
