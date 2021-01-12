/**
 * Слушающий http сервер
 * Обрабатывает запросы через методы httphandler
 */

const util = require('util');
const url = require('url');
const fs = require('fs');
const http = require('http');

const express = require('express');
const bodyParser = require('body-parser');
// const expressFileUpload = require('express-fileupload');
// const cors = require('cors');
// const morgan = require('morgan');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

module.exports = async function(holder) {
  // const syspath = path.join(__dirname, '../../..'); // /opt/intrahouse-d/<>/backend/lib/web/
  const port = normalizePort(appconfig.get('apiport')) || 3002;
  const express_app = express();

  // Configure express
  // express_app.use(cors());
  // express_app.use(morgan('common'));

  express_app.use(bodyParser.urlencoded({ extended: false }));
  express_app.use(bodyParser.json({ limit: '50mb', extended: true }));

  // Endpoints
  // express_app.post('/upload', uploadfiles(holder));

  express_app.get('/*', onRequest());

  const server = http.createServer(express_app);
  server.keepAliveTimeout = 60000 * 3;

  server.listen(port, () => console.log('INFO: Http rest API has started on http://localhost:' + port));

  server.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
    console.log('ERROR: ' + mes);
  });

  function onRequest(post) {
    return async (req, res) => {
      const err = await tryRunHandler();
      if (err) {
        res.status(400).end('Error: ' + err); // 400 - Bad Request
      }

      async function tryRunHandler() {
        const doc = await getApihandlerDoc(req, post);
        if (!doc) return 'Not found handler for ' + req.path;

        const id = doc._id;
        debug('=> HTTP GET ' + req.path);
        try {
          const filename = appconfig.getApihandlerFilename(id);
          if (!fs.existsSync(filename)) throw { message: 'Not found handler: ' + filename };
          require(filename)(req, res, holder, debug);
        } catch (e) {
          console.log('ERROR: httprestservice req.path ' + req.path + ': ' + util.inspect(e));
          return hut.getShortErrStr(e);
        }

        function debug(msg) {
          holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
        }
      }
    };
  }

  async function getApihandlerDoc(req) {
    const parsed = url.parse(req.url, true);
    const endpoint = parsed.pathname;
    return holder.dm.dbstore.findOne('apihandlers', { endpoint });
  }
};

function normalizePort(val) {
  const p = parseInt(val, 10);
  return isNaN(p) || p <= 0 ? '' : p;
}
/*
module.exports = async function(holder) {

  http
    .createServer(onRequest)
    .listen(port)
    .on('error', e => {
      let msg = e.code == 'EADDRINUSE' ? 'Address in use' : `${e.code} Stopped.`;
      console.log(`ERROR: HTTP server port: ${port} error ${e.errno}. ${msg}`);
      process.exit(1);
    });

  console.log('INFO: Http rest API on localhost:' + port);

  async function onRequest(req, res) {
    const parsed = url.parse(req.url, true);
    console.log('PARSED=' + util.inspect(parsed));
    const endpoint = parsed.pathname;

    const doc = await dm.dbstore.findOne('apihandlers', { endpoint });
    if (!doc) {
      res.end('Not found endpoint: ' + endpoint);
      return;
    }
    const id = doc._id;
    debug('=> HTTP GET ' + parsed.path);

    try {
      const filename = appconfig.getApihandlerFilename(id);
      if (!fs.existsSync(filename)) throw { message: 'Not found handler: ' + filename };
      require(filename)(req, res, dm, debug);
      return;
    } catch (e) {
      console.log('ERROR: httprestservice: ' + util.inspect(e));
      res.end('Error! ' + hut.getShortErrStr(e));
    }

    

    
    res.on('error', e => {
      httpServerLog('<=', ' ERROR:' + e.code);
    });
  }

  function httpServerLog(dir, msg) {
    console.log(`INFO: ${dir} localhost:${port} ${msg}`);
  }
};

*/
