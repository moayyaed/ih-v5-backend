/**
 * wsserver.js
 */

const util = require('util');

const WebSockets = require('ws');
const shortid = require('shortid');

// const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const auth = require('./auth');
const wsmobile = require('./wsmobile');
const dataonsubscribe = require('../appspec/dataonsubscribe');
const commander = require('../appspec/commander');
const visscript = require('../appspec/visscript');

exports.start = function(server, holder) {
  const wss = new WebSockets.Server({ server });
  const clients = {};
  const watchSet = {};
  const transferSet = {};

  wss.on('connection', async (ws, request) => {
    let clid = request.headers['sec-websocket-key'];

    // console.log('Socket connected  ' + clid);
    let native = '';
    let user;
    let token = '';

    if (request.url == '/backend') {
      native = 'v4';
    } else {
      token = request.url;
      if (!token || token.length < 2) {
        console.log('NO TOKEN - TERMINATE');
        ws.terminate();
        return;
      }

      token = token.substr(1); // /d224a72f53df38559dfa12da7c97bd8c64949e10046d504e531499b13edf6c6e
      // По токену определить пользователя
      user = await auth.getUserByToken(token);
    }
    // logMsg('Socket connected  ' + clid, 2);

    clients[clid] = {
      ws,
      user,
      clid,
      native,
      ip: getClientIP(ws),
      subs: new Map(),
      mobile: isMobile(request.headers['user-agent']),
      lastTs: Date.now()
    };

    // console.log('Socket connected  ' + clid + ' token=' + token + ' native=' + native);

    // ws.isAlive = true;
    // ws.on('pong', heartbeat);

    ws.on('message', message => {
      // console.log(clid + ' => ' + message);
      // Браузер досылает в уже закрытый сокет - это брать не надо (после reconnect присылает type:ping на старый clid)
      if (!clients[clid]) return;

      clients[clid].lastTs = Date.now(); // запомнить время последнего принятого сообщения

      if (clients[clid].native) {
        const mes = tryCommonRequest(message);
        if (mes) {
          processAsCommon(mes);
        } else {
          wsmobile.processMessage(clients[clid], message, holder);
        }
        return;
      }

      processMessage(clid, message);
    });

    function tryCommonRequest(message) {
      try {
        const mes = JSON.parse(message);
        // console.log(clid + ' NATIVE mes=' + util.inspect(mes));
        if (typeof mes == 'object' && mes.type == 'transferdata') return mes;
      } catch (e) {
        // console.log('ERROR:' + util.inspect(e));
      }
    }

    function processAsCommon(mes) {
      try {
        if (mes.type == 'transferdata') {
          transferSet[mes.uuid] = clid;
          doTransferdata(clid, mes);
        } else throw { messsage: 'Not common type ' + mes.type };
      } catch (e) {
        send(clid, formResponse(mes, '', e));
      }
    }

    ws.on('close', code => {
      logMsg('Socket disconnected ' + clid + '.  Code=' + code, 2);

      // Отправить на плагин для transferdata что уже нет соединения
      Object.keys(transferSet).forEach(uuid => {
        if (transferSet[uuid] == clid) {
          holder.emit('transferdata_in', { id: uuid, uuid, unit: 'webconsole', method: 'unsub' });
          delete transferSet[uuid];
        }
      });

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

  // Отправка сообщения конкретному клиенту от сервера
  holder.on('wssend', (clid, message) => {
    send(clid, formServerMessage(message));
  });

  holder.on('debug', (uuid, message) => {
    const arr = getSubsWithUuid('debug', uuid);
    arr.forEach(item => {
      send(item.clid, formResponse(item.subsItem, { data: message }));
    });
  });

  // changed = {did: 'd0803', dn: 'LAMP1', prop: 'value', ts: 1597489786943, value: 1, changed: 1, prev: 0}
  holder.on('changed:device:data', changed => {
    sendOnSub('container', { contextId: 1 }, changed); // Измененные устройства находятся внутри контейнера
    sendOnSub('layout', {}, changed); // Измененные устройства находятся на экране
    sendOnSub('dialog', { contextId: 1 }, changed); // Измененные устройства находятся на диалоге
    sendOnSubMobile('mobile_devices', changed);
  });

  // changed = [ { did: 'gl014', prop: 'regime', ts: 1597489786943, value: 1, changed: 1, prev: 0 } ]
  holder.on('changed:globals', changed => {
    sendOnSub('container', {}, changed); // Измененные переменные находятся внутри контейнера
    sendOnSub('layout', {}, changed); // Измененные переменные находятся на экране
    sendOnSub('dialog', {}, changed); // Измененные переменные находятся на диалоге
  });

  // watch, scan - Это уникальные процессы конкретного клиента
  // В объекте должен быть uuid
  holder.on('watch', watchObj => {
    if (watchObj && watchObj.uuid && watchSet[watchObj.uuid]) {
      const clid = watchSet[watchObj.uuid];
      send(clid, watchObj);
    }
  });

  holder.on('scan', watchObj => {
    if (watchObj && watchObj.uuid && watchSet[watchObj.uuid]) {
      const clid = watchSet[watchObj.uuid];
      if (watchObj.err) {
        send(clid, formResponse({ uuid: watchObj.uuid }, '', watchObj.err));
      } else {
        send(clid, watchObj);
      }
    }
  });

  // От плагина на клиент по подписке
  holder.on('transferdata_out', data => {
    // console.log('WARN: transferdata_out uuid=' + data.uuid);
    if (!data || !data.uuid) return;
    if (!transferSet[data.uuid]) {
      console.log(
        'ERROR: Missing client for transferdata with uuid=' + data.uuid + ' transferSet=' + util.inspect(transferSet)
      );
      return;
    }

    const clid = transferSet[data.uuid];
    checkTransferEnabled(clid, data);
    // console.log('WARN: transferdata_out send to ' + clid);
    send(clid, data);
  });

  /** sendclid
   *  @param {Object} data - {command:'system', <param:[]>, login}
   */
  holder.on('sendclid', (clid, sendArray) => {
    if (Array.isArray(sendArray)) {
      sendArray.forEach(item => {
        send(clid, item);
      });
    } else {
      send(clid, sendArray);
    }
  });

  //  >> ЭТО ЗАГЛУШКА для подписки
  /*
  const interval = setInterval(() => {
    holder.emit('devicelog', {
      did: 'd0045',
      data: [
        { title: 'title', message: 'Test devicelog' },
        { title: 'title2', message: 'Test2 devicelog' }
      ]
    });
  }, 2000);
  */
  //  << ЭТО ЗАГЛУШКА

  holder.on('devicelog', logObj => {
    sendOnSub_Log('dialog', logObj, 'devicelog');
    sendOnSub_Log('container', logObj, 'devicelog');
    sendOnSub_Log('layout', logObj, 'devicelog');
  });

  // logObj = {op:'add', payload:[..], ajarr:[] }
  holder.on('alertlog', logObj => {
    sendOnSub_Log('dialog', logObj, 'alertlog');
    sendOnSub_Log('container', logObj, 'alertlog');
    sendOnSub_Log('layout', logObj, 'alertlog');
  });

  // Отправить по подписке журнал устройства. Он может быть на экране, в диалоге или контейнере
  async function sendOnSub_Log(event, logObj, logname) {
    // console.log('WARN: sendOnSub_Log '+event+' logObj='+util.inspect(logObj));

    const curSubMap = getSubMap(event); // curSubMap = Map: key=vc003:[{clid:cid1, uuid}, ..], key=vc007:[cid1, cid2, cid3]

    for (let [key, clientArr] of curSubMap) {
      // console.log('Подписчики: key='+key+' clientArr='+util.inspect(clientArr))
      for (let clItem of clientArr) {
        if (clItem.subsItem) {
          let data;

          if (logname == 'devicelog') {
            let res = await dataonsubscribe.formDeviceLogOnSub(event, key, logObj, clItem.subsItem.contextId, holder);
            if (res) data = { data: res };
            /*
            data = {
              data: await dataonsubscribe.formDeviceLogOnSub(event, key, logObj, clItem.subsItem.contextId, holder)
            };
            */
          } else if (logname == 'alertlog') {
            if (clItem.subsItem.ajarr) {
              data = await dataonsubscribe.formAlertLogOnSub(event, key, logObj, clItem.subsItem.ajarr, holder);
            }
          }

          if (data) {
            // console.log('WARN: sendOnSub_Log '+event+' data='+util.inspect(data));
            send(clItem.clid, formResponse({ uuid: clItem.uuid, sid: clItem.subsItem.sid }, data));
          }
        }
      }
    }
  }

  // Отправить по подписке
  async function sendOnSub(event, paramObj, changed) {
    // Выбрать подписчиков по этой теме среди клиентов -
    // например, на какие устройства, контейнеры, ... есть подписка
    // console.log('WARN: sendOnSub '+event+' changed='+util.inspect(changed));

    const curSubMap = getSubMap(event); // curSubMap = Map: key=vc003:[{clid:cid1, uuid}, ..], key=vc007:[cid1, cid2, cid3]

    for (let [key, clientArr] of curSubMap) {
      // clientArr - массив подписчиков, key - id контента (container, dialog)
      // Для контента на который есть подписка, сформировать сообщение
      let data;
      data = await dataonsubscribe.formMessageOnSub(event, key, changed, holder);

      if (data && (data.data || data.chartdata)) {
        // console.log('WARN: sendOnSub data='+util.inspect(data));
        // Отправить сообщение каждому клиенту-подписчику
        clientArr.forEach(clItem => {
          send(clItem.clid, formResponse({ uuid: clItem.uuid, sid: clItem.subsItem.sid }, data));
        });
      }

      if (paramObj.contextId) {
        // Выбрать данные по контексту для каждого клиента (каждой подписки отдельно)
        // Здесь уже отфильтровано по event
        for (let clItem of clientArr) {
          if (clItem.subsItem && clItem.subsItem.contextId) {
            data = await dataonsubscribe.formChangedForContext(changed, clItem.subsItem, holder);
            if (data && (data.data || data.chartdata)) {
              // console.log('WARN: sendOnSub by context data='+util.inspect(data));
              send(clItem.clid, formResponse({ uuid: clItem.uuid, sid: clItem.subsItem.sid }, data));
            }
          }
        }
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
          res.get(id).push({ clid, uuid, subsItem });
        }
      });
    });
    return res;
  }

  // @return array: [{ clid, uuid, subsItem }, ...]
  function getSubsWithUuid(event, withUuid) {
    const res = [];
    Object.keys(clients).forEach(clid => {
      clients[clid].subs.forEach((subsItem, uuid) => {
        if (subsItem.type == event && uuid == withUuid) {
          res.push({ clid, uuid, subsItem });
        }
      });
    });
    return res;
  }

  // event = mobile_devices
  function sendOnSubMobile(event, changed) {
    const arr = getSubsMobile(event);
    if (!arr.length) return;

    // Сформировать сообщение и отправить всем
    const data = wsmobile.formOnSub(changed, holder);
    if (!data) return;

    arr.forEach(clItem => {
      send(clItem.clid, { uuid: clItem.uuid, response: 1, ...data });
    });
  }

  function getSubsMobile(event) {
    const res = [];
    Object.keys(clients)
      .filter(clid => clients[clid].native)
      .forEach(clid => {
        clients[clid].subs.forEach((subsItem, uuid) => {
          if (subsItem.type == event) {
            res.push({ clid, uuid, subsItem });
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
      // console.log('INFO: <= ' + str);
    } else {
      logMsg(clid + ' Send error:' + str + '. Socket not opened!', 3);
    }
  }

  async function processMessage(clid, message) {
    let mes;

    try {
      // console.log('processMessage '+message)
      mes = JSON.parse(message);
      /*
      if (mes.type == 'auth') {
          const res = {uuid:mes.uuid, noencrypt:1, response:1}
          const user = await auth.getUserByLogin(mes.route.login,mes.route.hpw);
          if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
      
          res.token = auth.createNewToken(mes.login);
          send(clid, res);
        return;
      }
      */
      checkIncomingMessage(clid, mes);

      /*
      if (mes.short) {
        send(clid, wsmobile.processMessage(clid, mes, holder));
        return;
      }
      */

      switch (mes.method) {
        case 'action':
        case 'row_command':
          await doAction(clid, mes);
          break;

        case 'sub':
          await doSub(clid, mes);
          break;
        case 'unsub':
          doUnsub(clid, mes);
          break;

        case 'transferdata':
          // Проверить ограничение доступа для transferdata (unit=webconsole -> user д б expert)
          checkTransferEnabled(clid, mes);
          doTransferdata(clid, mes);
          break;

        default:
          throw { message: 'Unexpected method: ' + mes.method };
      }
    } catch (e) {
      send(clid, formResponse(mes, '', e));
    }
  }

  function checkIncomingMessage(clid, mes) {
    const { method, short, uuid } = mes;
    if (!clid) throw { message: 'Missing client id!' };
    if (!uuid) throw { message: 'Missing uuid!' };
    if (short) return;
    if (!method) throw { message: 'Missing method!' };
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
  async function doAction(clid, mes) {
    if (!mes) return;

    const user = clients[clid].user;
    let res;
    switch (mes.type) {
      case 'command':
        if (mes.command == 'visscript') {
          res = await visscript.execCommand(clid, mes, holder);
        } else {
          // "type":"command", "command":"device",  "did":"d003", "prop":"on"
          // "type":"command", "command":"layout", "id":"l003", ...
          res = await commander.exec(user, mes.command, mes, holder);
        }
        break;

      case 'set':
      case 'devicecommand':
        res = await commander.exec(user, mes.type, mes, holder);
        break;
      default:
        res = !mes.type ? { err: 'Missing action type!' } : { err: 'Unexpected type: ' + mes.type };
    }

    send(clid, formResponse({ uuid: mes.uuid, sid: mes.sid }, '', res.err || '')); // Ответ на запрос

    // Отправить команду (переключение экрана, ...)
    if (res.toSend) {
      send(clid, formServerMessage(res.toSend));
    }
  }

  holder.on('restart', () => {
    Object.keys(clients).forEach(clid => {
      send(
        clid,
        formServerMessage({
          method: 'syscommand',
          command: 'alert',
          alert: 'info',
          message: 'Перезагрузка сервера...'
        })
      );
    });
    Object.keys(clients).forEach(clid => {
      send(clid, formServerMessage({ method: 'syscommand', command: 'restart' }));
    });
  });

  /**  Обработка запроса sub: method:'sub, type:'debug', id:?, nodeid:'scen001'   */
  // {"method":"sub","type":"container","id":"vc005","uuid":"vc005"} - подписка на контейнер vc005
  // => {"uuid":"vc005","data":{"template_2":{"state1":1}}} - при изменении значений

  async function doSub(clid, mes) {
    // const subobj = { id: mes.id, nodeid: mes.nodeid };
    // if (!clients[clid].subs.has(mes.type)) clients[clid].subs.set(mes.type, []);
    // clients[clid].subs.get(mes.type).push(mes);
    const uuid = mes.uuid;
    if (mes.type == 'watch') {
      // Уникальные подписки на процессы, запущенные клиентом индивидуально
      watchSet[mes.uuid] = clid;
    } else if (mes.type == 'scan') {
      if (!mes.params || !mes.params.unit) {
        const res = { err: 'Missing params.unit!' };
        send(clid, formResponse({ uuid: mes.uuid }, '', res.err));
        return;
      }
      // Уникальные подписки на процессы, запущенные клиентом индивидуально
      watchSet[mes.uuid] = clid;
      // Передать команду на плагин
      holder.emit('scan:plugin', mes.params.unit, { id: uuid, uuid, ...mes.params });
    } else if (mes.type == 'transferdata') {
      transferSet[mes.uuid] = clid;
      holder.emit('transferdata_in', { id: uuid, uuid, unit: 'webconsole', method: 'sub' });
    } else if (mes.type == 'container') {
      // Формировать условия подписки с учетом контекста
      const subMes = await dataonsubscribe.formContainerSubConditionWithContext(mes, holder);
      clients[clid].subs.set(mes.uuid, subMes);
    } else {
      // Если в подписке есть contextId - сформировать свойство byContext:{chart:{}, devicelog:}
      // if (mes.contextId) {
      //  Object.assign(mes, )
      // }
      if (mes.devicecontext) {
        mes.contextId = mes.devicecontext;
      }
      clients[clid].subs.set(mes.uuid, mes);

      if (mes.type == 'debug') {
        // При подписке - всегда генерируется событие, даже если есть другие подписчики
        // При отписке - только если больше нет подписчиков
        holder.emit('debugctl', 1, mes.uuid);
      }
    }
    // Просто ответ что подписка принята (без данных?)
    // send(clid, formResponse(mes));
  }

  /**  Обработка запроса unsub - отписка по uuid? */
  function doUnsub(clid, mes) {
    if (!mes.uuid) return;

    const uuid = mes.uuid;

    if (watchSet[mes.uuid]) {
      delete watchSet[mes.uuid];
      if (mes.type == 'scan') {
        holder.emit('scan:plugin', mes.params.unit, { stop: 1, id: uuid, uuid, ...mes.params });
      }
      return;
    }

    if (transferSet[mes.uuid]) {
      // Передать отписку на плагин??
      holder.emit('transferdata_in', { id: uuid, uuid, unit: 'webconsole', method: 'sub' });
      delete transferSet[mes.uuid];
      return;
    }

    if (clients[clid].subs.has(mes.uuid)) {
      if (mes.type == 'debug') {
        // uuid = 'plugim_emuls'
        // Cбрасывать подписку только если больше нет клиентов с этой подпиской
        const arr = getSubsWithUuid('debug', mes.uuid);
        if (!arr.length) {
          holder.emit('debugctl', 0, mes.uuid);
        }
      }
      clients[clid].subs.delete(mes.uuid);
    }
  }

  // {"method":"transferdata" | "type":"transferdata","uuid":"12345","unit":"webconsole","payload":{"data":[]}}
  function doTransferdata(clid, mes) {
    const { id, uuid, unit, payload } = mes;

    if (uuid === undefined) throw { message: 'Expected uuid for transferdata!' };
    if (unit === undefined) throw { message: 'Expected unit for transferdata!' };
    if (!holder.unitSet[unit]) throw { message: 'Missing plugin ' + unit };
    if (!holder.unitSet[unit].ps) throw { message: 'Plugin ' + unit + ' is not running!' };

    if (payload) {
      holder.emit('transferdata_in', { id, uuid, unit, payload });
    }
    send(clid, formResponse(mes));
  }

  function checkTransferEnabled(clid, mes) {
    if (mes && mes.unit == 'webconsole') {
      if (!clients[clid].user || !clients[clid].user.expert) {
        send(
          clid,
          formServerMessage({
            method: 'syscommand',
            command: 'alert',
            alert: 'info',
            message: appconfig.getMessage('InsuffRights')
          })
        );

        throw { message: appconfig.getMessage('InsuffRights') };
      }
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
  if (inobj && inobj.sid) robj.sid = inobj.sid;

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

// ---Со стороны клиента
// Подписка на сообщения от плагина
// {"method":"sub","uuid":"12345","unit":"webconsole","type":"transferdata"}
// => на плагин отправляется: ??

// Отписка
// {"method":"unsub","uuid":"12345","unit":"webconsole"}
// => на плагин отправляется: ??

// Отправка сообщения от клиента на плагин
// {"method":"transferdata","uuid":"12345","unit":"webconsole","payload":{}}
// => на плагин отправляется: { type: 'transferdata', id: uuid, uuid, payload }

// ---Со стороны плагина
// { "type":"transferdata", id, uuid, payload }
// => на клиент по подписке отправляется: { type: 'transferdata', id: uuid, uuid, payload }

// {"method":"sub","type":"scan","uuid":"123","params":{"unit":"mqttclient1"}}

/** Внутри layout - базовые привязки для контейнера (вызов без frames)
 *  
 * elements:{
 *  frame_1: {
 * "widgetlinks": {
            "link": {
              "id": "vc076",
              "title": "Контейнер с журналами",
              "value": {
                "device": "",
                "multichart_id": "",
                "timelinechart_id": "",
                "journal_id": {
                  "id": "jr002",
                  "title": "Новый журнал"
                },
                "alertjournal_id": {
                  "id": "ajr003",
                  "title": "Журнал протечек"
                }
              }
            }

     Внутри container
      "alertlog_2": {
         "widgetlinks": {
            "link": {
              "id": "__alertjournal",
              "title": "Любой журнал",
              "value": {}
            }
          },
          "data": [],
          "type": "alertlog",
        }
      }       
 */
