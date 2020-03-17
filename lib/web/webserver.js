/**
 * webserver.js
 */

const util = require('util');

const http = require('http');
const app = require('./express_app');
const WebSockets = require('ws');

exports.start = function(holder) {
  // Start server
  const port = 3000;
  const server = http.createServer(app);
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

  //
  const wss = new WebSockets.Server({ server });
  const clients = {};

  wss.on('connection', (ws, request, client) => {
    console.log('request.headers' + util.inspect(request.headers));

    let clid = request.headers['sec-websocket-key'];
    console.log(clid);

    // console.log('ws'+util.inspect(ws));
    console.log('PROTOCOL:' + util.inspect(ws.protocol));

    //  console.log('request.rawHeaders'+util.inspect(request.rawHeaders));
    // console.log('client '+util.inspect(client));

    logMsg('Socket connected  ' + clid, 2);

    let ip = getClientIP(ws);

    clients[clid] = {
      ws,
      ip,
      subs: new Map(),
      mobile: isMobile(request.headers['user-agent']),
      lastTs: Date.now()
    };

    // ws.isAlive = true;
    // ws.on('pong', heartbeat);

    ws.on('message', message => {
      // logMsg(clid + ' => ' + message, 3);
      // Браузер досылает в уже закрытый сокет - это брать не надо (после reconnect присылает type:ping на старый clid)
      if (clients[clid]) {
        clients[clid].lastTs = Date.now(); // запомнить время последнего принятого сообщения
        processMessage(clid, message);
      }
    });

    ws.on('close', code => {
      logMsg('Socket disconnected ' + clid + '.  Code=' + code, 2);
      if (clients[clid]) {
        if (code >= 1000) {
          delete clients[clid]; // 1000 - Чисто закрытое соединение
          logMsg('Client deleted ' + clid, 2);
        } else {
          clients[clid].lastTs = Date.now(); // иначе возможен reconnect на другом сокете
        }
        // writeAuthLog(clid, 0);
      }
    });
  });

  let x = 0;
  const interval = setInterval(() => {
    Object.keys(clients).forEach(clid => {
      if (clients[clid].subs.has('debug')) {
        send(clid, { type: 'sub', id:'debug', data: 'test_'+String(x) });

        console.log(JSON.stringify({ type: 'sub', id:'debug', data: x }));
        x += 1;
      }
    });
  }, 1000);

  /**
   *  Передача сообщения клиенту
   * @param {String} clid - ид-р сокета
   * @param {Object} obj - сообщение для отправки
   */
  function send(clid, obj) {
    let str = typeof obj == 'object' ? JSON.stringify(obj) : String(obj);
    if (clients[clid] && clients[clid].ws && clients[clid].ws.readyState === WebSockets.OPEN) {
      clients[clid].ws.send(str);
      // logMsg(' <= ' + str, 3);
    } else {
      // logMsg(clid + ' Send error:' + str + '. Socket not opened!', 3);
    }
  }

  function processMessage(clid, message) {
    let mes;
    mes = JSON.parse(message);
    console.log(util.inspect(mes));

    switch (mes.type) {
      case 'sub':
        doSub(clid, mes);
        break;
      case 'unsub':
          doUnsub(clid, mes);
          break;

      default:
    }
  }

  /**  Обработка запроса sub   */
  function doSub(clid, mes) {
    if (clid === undefined) throw { message: 'Missing client id!' };
    if (mes.id === undefined) throw { message: 'Missing id!' };

    let subobj = { route: mes.route }; // В случае ошибки объект не возвращается, уйдет по throw из getSubobj
    if (subobj) {
      clients[clid].subs.set(mes.id, subobj);

      // Просто ответ что подписка принята (без данных) {type:sub, id, uuid -как в запросе}

      send(clid, { type: 'sub', response: 1 });
    }
  }

   /**  Обработка запроса unsub - отписка по id */
   function doUnsub(clid, mes) {
    if (clid === undefined) throw { message: 'Missing client id!' };
    if (mes.id === undefined) throw { message: 'Missing id!' };
    if (clients[clid].subs.has(mes.id)) {
     
      clients[clid].subs.delete(mes.id);
    }
    
    send(clid, { type: 'unsub', response: 1 });
  }
};

function logMsg(text, level) {
  console.log(text);
}

/**  Helper functions */
function isMobile(userAgent) {
  return userAgent && userAgent.indexOf('Mobile') > 0 && userAgent.indexOf('iPad') < 0;
}

function getClientIP(ws) {
  let res = ws._socket.remoteAddress || '';
  if (res) {
    let j = res.indexOf('ff:');
    if (j >= 0) res = res.substr(j + 3);
  }
  // let ipfwd= ws.upgradeReq.headers['x-forwarded-for'] || '';
  return res;
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
