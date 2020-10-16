/**
 * webserver.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const expressFileUpload = require('express-fileupload');
// const cors = require('cors');
const morgan = require('morgan');

const wsserver = require('./wsserver');
const apirequest = require('./apirequest');
const appconfig = require('../appconfig');
const uploadfiles = require('./uploadfiles');
const imp = require('./import');

module.exports = async function(holder) {
  const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/
  const imagePath = appconfig.get('projectpath') + '/images/';

  const express_app = express();

  // Configure express
  // express_app.use(cors());
  express_app.use(morgan('common'));
  express_app.use(bodyParser.urlencoded({ extended: false }));
  express_app.use(bodyParser.json({limit: '50mb', extended: true}));
  express_app.use(expressFileUpload());

  /*
  bodyParser = {
    json: {limit: '50mb', extended: true},
    urlencoded: {limit: '50mb', extended: true}
  };
*/

  // Endpoints
  express_app.post('/upload', uploadfiles(holder));  // загрузка файлов
  express_app.post('/import', imp(holder));  // загрузка пакетов
  express_app.use('/api/', apirequest(holder));

  express_app.use('/static/', express.static(`${syspath}/frontend/admin/static`));
  express_app.use('/static/', express.static(`${syspath}/frontend/user/static`));
  express_app.use('/images', express.static(imagePath));

  express_app.get('/images/noimage.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(appconfig.getNoImage());
  });

  express_app.get('*/index.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getIndex(req.url));
  });

  express_app.get('/*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getIndex(req.url));
  });

  // Start http
  const port = normalizePort(appconfig.get('port') || '3000');
  const server = http.createServer(express_app);
  server.keepAliveTimeout = 60000 * 3;

  server.listen(port, () => console.log('INFO: Webserver has started on http://localhost:' + port));

  server.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
    console.log('ERROR: ' + mes);
    process.exit(1);
  });

  // Start websocket
  wsserver.start(server, holder);

  function normalizePort(val) {
    const p = parseInt(val, 10);
    return isNaN(p) || p <= 0 ? '' : p;
  }

  function getIndex(url) {
    try {
      let folder = 'user';
      if (url && url.startsWith('/admin')) {
        folder = 'admin';
      }
      return fs.readFileSync(syspath + '/frontend/' + folder + '/index.html');
    } catch (e) {
      console.log('ERROR: webserver.getIndex ' + util.inspect(e));
    }
  }
};

/*
function getNoImage() {
  return fs.readFileSync(appconfig.get('sysbasepath') + '/noimage.svg');
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

/*
 express_app.use('/images', (req, res) => {
  const p = imagePath;
  // const p = appconfig.get('projectpath')+'/images/';
  // const p = '/var/lib/intrahouse-d/projects/testproject/images/';
  const file = p+'/plan2.png';
  console.log('EXPRESS sendFile ' +file);
 
   res.sendFile(file);
 });
 */
