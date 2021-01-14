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
  const port = normalizePort(appconfig.get('apiport')) || 3002;
  const express_app = express();

  // Configure express
  express_app.use(bodyParser.urlencoded({ extended: false }));
  express_app.use(bodyParser.json({ limit: '50mb', extended: true }));

  // Endpoints
  // express_app.post('/upload', uploadfiles(holder));

  express_app.get('/*', onRequest());
  express_app.post('/*', onRequest(1));

  const server = http.createServer(express_app);
  server.keepAliveTimeout = 60000 * 3;

  server.listen(port, () => console.log('INFO: Http rest API has started on http://localhost:' + port));

  server.on('error', e => {
    const mes = e.code == 'EADDRINUSE' ? 'EADDRINUSE: Address in use ' + port : +e.code;
    console.log('ERROR: ' + mes);
  });

  function onRequest(post) {
    return async (req, res) => {
      const err = await tryRunHandler(post);
      if (err) {
        // res.status(400).end('Error: ' + err); // 400 - Bad Request
        res.status(400).json({ res: 0, message:err });
        
      }

      async function tryRunHandler() {
        const method = post ? 'POST' : 'GET'; 
        const doc = await getApihandlerDoc(req, post);
        if (!doc) return 'Not found handler for HTTP ' + method+' '+req.path;

        const id = doc._id;
        debug('=> HTTP '+method+' ' + req.path);
        debug(post ? 'body: ' +util.inspect(req.body) : 'query:' + util.inspect(req.query));
        try {
          const filename = appconfig.getApihandlerFilename(id);
          if (!fs.existsSync(filename)) throw { message: 'Not found handler: ' + filename };
          require(filename)(req, res, holder, debug);
        } catch (e) {
          console.log('ERROR: httprestservice req.path ' + req.path + ': ' + util.inspect(e));
          const errStr = hut.getShortErrStr(e);
          debug('ERROR: '+errStr)
          return errStr;
        }

        function debug(msg) {
          holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
        }
      }
    };
  }

  async function getApihandlerDoc(req, post = 0) {
    const parsed = url.parse(req.url, true);
    const endpoint = parsed.pathname;
    const rec = await holder.dm.dbstore.findOne('apihandlers', { endpoint });
    if (rec) {
      return (rec.httpmethod  == 'POST' && post) || (rec.httpmethod  != 'POST' && !post) ? rec : '';
    }
  }
};

function normalizePort(val) {
  const p = parseInt(val, 10);
  return isNaN(p) || p <= 0 ? '' : p;
}

