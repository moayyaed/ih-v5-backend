/**
 * wsserver.js
 */

const util = require('util');

const WebSockets = require('ws');
const shortid = require('shortid');

const dataonsubscribe = require('../appspec/dataonsubscribe');
const commander = require('../appspec/commander');

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

  //  >> ЭТО ЗАГЛУШКА для механизма подписки
  /*
  let x = 0;
  const interval = setInterval(() => {
    Object.keys(clients).forEach(clid => {
      clients[clid].subs.forEach((subsItem, uuid) => {
        if (subsItem.type == 'debug') {
          const data = subsItem.nodeid + '_' + String(x);
          send(clid, formResponse(subsItem, { data }));
          x += 1;
        }
      })
     
    });
  }, 1000);
  */
  //  << ЭТО ЗАГЛУШКА

  holder.on('changed:device:data', changed => {
    sendOnSub('container', {}, changed); // Измененные устройства находятся внутри контейнера
    sendOnSub('layout', {}, changed); // Измененные устройства находятся на экране
  });

  // Отправить по подписке
  async function sendOnSub(event, paramObj, changed) {
    // Выбрать подписчиков по этой теме среди клиентов -
    // например, на какие устройства, контейнеры, ... есть подписка

    const curSubMap = getSubMap(event); // curSubMap = Map: key=vc003:[{clid:cid1, uuid}, ..], key=vc007:[cid1, cid2, cid3]

    // curSubMap.forEach((clientArr, key) => {
    for (let [key, clientArr] of curSubMap) {
      // clientArr - массив подписчиков, key - id контента (container)

      // Для контента на который есть подписка, сформировать сообщение
      const data = await dataonsubscribe.formMessageOnSub(event, key, changed, holder);
      if (data) {
        // Отправить сообщение каждому клиенту-подписчику
        clientArr.forEach(clItem => {
          send(clItem.clid, formResponse({ uuid: clItem.uuid }, { data }));
        });
      }
    }
  }

  // @return Map: key=vc003:[cid1, cid2], key=vc007:[{clid:cid1, uuid}, ...]
  function getSubMap(event) {
    const res = new Map();
    Object.keys(clients).forEach(clid => {
      clients[clid].subs.forEach((subsItem, uuid) => {
        if (subsItem.type == event) {
          const id = subsItem.id;
          if (!res.has(id)) res.set(id, []);
          res.get(id).push({ clid, uuid });
        }
      });
    });
    return res;
  }

  /**
   *  Передача сообщения клиенту
   * @param {String} clid - ид-р сокета
   * @param {Object} obj - сообщение для отправки
   */
  function send(clid, obj) {
    let str = typeof obj == 'object' ? JSON.stringify(obj) : String(obj);
    if (clients[clid] && clients[clid].ws && clients[clid].ws.readyState === WebSockets.OPEN) {
      clients[clid].ws.send(str);
      // console.log(' <= ' + str, 3);
    } else {
      logMsg(clid + ' Send error:' + str + '. Socket not opened!', 3);
    }
  }

  function processMessage(clid, message) {
    let mes;
    console.log(util.inspect(message));

    try {
      mes = JSON.parse(message);
      checkIncomingMessage(clid, mes);

      switch (mes.method) {
        case 'action':
          doAction(clid, mes);
          break;

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
    // if (!type) throw { message: 'Missing type!' };
    // if (!id) throw { message: 'Missing id!' };
    if (!uuid) throw { message: 'Missing uuid!' };
  }

  /**  Обработка запроса action:
   * Для устройства 2 варианта:
   * {"method":"action", "type":"command", "command":"device",  "did":"d003", "prop":"on", "uuid":"xyzjjk"}
   * ИЛИ
   * {"method":"action", "type":"devicecommand", "id":"d003", "command":"on", "uuid":"xyzjjk"}
   *
   * Остальные запросы:
   * {"method":"action", "type":"command", "command":"layout", "id":"l003",  "value":{param1, param2,..},"uuid":"xyzjjk"}
   * {"method":"action", "type":"command", "command":"plugin", "id":"modbus1", "value":{param1, param2,..},  "uuid":"xyzjjk"}
   * {"method":"action", "type":"command", "command":"script", "id":"scen003", "value":{param1, param2,..},  "uuid":"xyzjjk"}
   *
   */
  function doAction(clid, mes) {
    let res;
    if (!mes.type) {
      res = {err : 'Missing action type!'};
    } else if (mes.type == 'command' ) {
      res = commander.execCommand(clid, mes);
    } else if (mes.type == 'devicecommand') {
      res = commander.execDeviceCommand(clid, { did: mes.id, prop: mes.command });
    } else {
      res = {err :'Unexpected type: ' + mes.type};
    }

    send(clid, formResponse({ uuid: mes.uuid }, '', res.err || '')); // Ответ на запрос

    // Отправить команду (переключение экрана, ...)
    if (res.toSend) {
      send(clid, formServerMessage(res.toSend));
    }
  }

  /**  Обработка запроса sub: method:'sub, type:'debug', id:?, nodeid:'scen001'   */
  // {"method":"sub","type":"container","id":"vc005","uuid":"vc005"} - подписка на контейнер vc005
  // => {"uuid":"vc005","data":{"template_2":{"state1":1}}} - при изменении значений

  function doSub(clid, mes) {
    // const subobj = { id: mes.id, nodeid: mes.nodeid };
    // if (!clients[clid].subs.has(mes.type)) clients[clid].subs.set(mes.type, []);
    // clients[clid].subs.get(mes.type).push(mes);
    clients[clid].subs.set(mes.uuid, mes);
    // Просто ответ что подписка принята (без данных?)
    // send(clid, formResponse(mes));
  }

  /**  Обработка запроса unsub - отписка по uuid? */
  function doUnsub(clid, mes) {
    if (mes.uuid && clients[clid].subs.has(mes.uuid)) {
      clients[clid].subs.delete(mes.uuid);
    }
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
    robj.response = 1;
  } else {
    robj.error = typeof err === 'object' ? err.message : String(err);
    robj.response = 0;
  }

  return robj;
}

function formServerMessage(toSend) {
  return { ...toSend, uuid: shortid.generate() };
}
