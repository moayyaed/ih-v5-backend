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
// const compression = require('compression')
// const cors = require('cors');
// const morgan = require('morgan');

const wsserver = require('./wsserver');
const runapiboot = require('../httprest/runapiboot');
const appconfig = require('../appconfig');

// Middlewares
const apirequest = require('./apirequest');
const portalrequest = require('./portalrequest');
const restapi = require('../httprest/restapi');
const inforequest = require('./inforequest');
const trendrequest = require('./trendrequest');
const reportrequest = require('./reportrequest');
const uploadfiles = require('./uploadfiles');
const imp = require('./import');

module.exports = async function(holder) {
  const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/
  const imagePath = appconfig.get('projectpath') + '/images/';
  const docimagePath = appconfig.get('projectpath') + '/docimages/';

  const soundPath = appconfig.get('soundpath');

  const project_frontend = appconfig.get('project_frontend');
  const projectfrontendpath = appconfig.get('projectfrontendpath');
  
  await runapiboot(holder);

  // Configure express
  const express_app = express();
  // express_app.use(cors());
  express_app.use((req, res, next) => {
    // const str = "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';"
    const str = "default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob: ; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline';";
    res.setHeader('Content-Security-Policy', str);
    res.setHeader('X-Frame-Options', '');
    next();
  });

  // express_app.use(morgan('common'));
  express_app.use(bodyParser.urlencoded({ extended: false }));
  express_app.use(bodyParser.json({limit: '50mb', extended: true}));
  express_app.use(bodyParser.raw());
  express_app.use(expressFileUpload());
  // 
  try {
    const compression = require('compression')
    express_app.use(compression())
  } catch (e) {
    console.log('ERROR: webserver compression: '+util.inspect(e))
  }


  // Endpoints
  express_app.get('/info', inforequest(holder, 'info'));  // GET Запрос, не требующий авторизации
  express_app.get('/messages', inforequest(holder, 'messages'));  // GET Запрос, не требующий авторизации

  express_app.post('/upload', uploadfiles(holder));  // загрузка файлов
  express_app.post('/import', imp(holder));  // загрузка пакетов

  express_app.use('/restapi', restapi(holder));
  express_app.use('/api/', apirequest(holder));
  express_app.use('/trend/', trendrequest(holder));
  express_app.use('/timeline/', trendrequest(holder, 'timeline'));
  express_app.use('/analytics/', trendrequest(holder, 'analytics'));
  express_app.use('/report/', reportrequest(holder));
  express_app.use('/portal/', portalrequest(holder));

  express_app.use('/pm', (req, res) => {
    res.redirect('/admin');
  });
  
  express_app.use('/static/', express.static(`${syspath}/frontend/admin/static`));
  express_app.use('/admin', express.static(`${syspath}/frontend/admin`));

  if (project_frontend) {
    express_app.use('/static/', express.static(`${projectfrontendpath}/static`));
    express_app.use('/', express.static(`${projectfrontendpath}`));
  } else {
    express_app.use('/static/', express.static(`${syspath}/frontend/user/static`));
    express_app.use('/', express.static(`${syspath}/frontend/user`));
  }

  express_app.use('/sounds', express.static(soundPath));
  
  express_app.use('/images', express.static(imagePath));
  express_app.get('/images/noimage.svg', (req, res) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(appconfig.getNoImage());
  });

 
  express_app.use('/images', express.static(docimagePath));

  express_app.use('/uploadfiles/images', express.static(imagePath));

  express_app.get('*/index.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getIndex(req.url));
  });

  express_app.get('/*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(getIndex(req.url));
  });

  // Start http
  const port = normalizePort(appconfig.get('port'));
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
    if (appconfig.get('project_frontend')) return appconfig.getIndex(url);
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


// WITH HTTPS:
// const https = require("https"),
//  fs = require("fs");

// const options = {
//  key: fs.readFileSync("/srv/www/keys/my-site-key.pem"),
//  cert: fs.readFileSync("/srv/www/keys/chain.pem")
// };

