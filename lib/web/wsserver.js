/**
 * wsserver.js
 */

const util = require('util');

const WebSockets = require('ws');

exports.start = function(server, holder) {
  const wss = new WebSockets.Server({ server });
  const clients = {};

  wss.on('connection', (ws, request, client) => {
    let clid = request.headers['sec-websocket-key'];

    console.log('PROTOCOL:' + util.inspect(ws.protocol));
    logMsg('Socket connected  ' + clid, 2);

    clients[clid] = {
      ws,
      ip: getClientIP(ws),
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
        const subsItem = clients[clid].subs.get('debug');
        const data = subsItem.nodeid+'_'+String(x);

        send(clid, formResponse(subsItem, {data}));
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
    console.log(util.inspect( message));

    try {
      mes = JSON.parse(message);
      checkIncomingMessage(clid, mes);

      switch (mes.method) {
        case 'sub':
          doSub(clid, mes);
          break;
        case 'unsub':
          doUnsub(clid, mes);
          break;

        default:
      }
    } catch (e) {
      send(clid, formResponse(mes, '', e));
    }
  }

  function checkIncomingMessage(clid, mes) {
      const { method, type, id, uuid } = mes;
    if (!clid) throw { message: 'Missing client id!' };
    if (!method) throw { message: 'Missing method!' };
    if (!type) throw { message: 'Missing type!' };
    if (!id) throw { message: 'Missing id!' };
    if (!uuid) throw { message: 'Missing uuid!' };
  }

  /**  Обработка запроса sub: type:'debug', id:?, nodeid:'scen001'   */
  function doSub(clid, mes) {
    const subobj = { id:mes.id, nodeod:mes.nodeid };

    clients[clid].subs.set(mes.type, mes);

    // Просто ответ что подписка принята (без данных) 
    // send(clid, formResponse(mes));
  }

  /**  Обработка запроса unsub - отписка по id */
  function doUnsub(clid, mes) {
   
    if (clients[clid].subs.has(mes.type)) {
      clients[clid].subs.delete(mes.type);
    }

    // send(clid, formResponse(mes));
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

function formResponse(inobj, outobj, err) {
  let robj = {};

  // if (inobj && inobj.id) robj.id = inobj.id;
  if (inobj && inobj.uuid) robj.uuid = inobj.uuid;

  if (!err) {
    if (outobj) {
      Object.assign(robj, outobj);
    }
    // robj.response = 1;
  } else {
    robj.error = typeof err === 'object' ? err.message : String(err);
    // robj.response = 0;
  }

  return robj;
}
