/**
 *  WSS url=/backend - connection
 * => connect
 * <= connect:connected
 * 
 * => {"uuid":"517255ec-e20d-41b0-99fa-5b4075e792d7",
 *   "type":"auth","id":"_",
 *   "route":{"client":"ui","login":"admin",
 *   "hpw":"cc3c49ccc51e0bb804a695f67d9f4d29c7f476149d3e79e3455440a5c92f50e7",
 *   "remember":0},"payload":{}}
 * <= {"uuid":"517255ec-e20d-41b0-99fa-5b4075e792d7",
 *     "noenctypt":1,
 *     "token":...  
 * 
 * CHERRY 
  => {"uuid":"855a9169-ef6b-41d6-a74f-55e906e7fd0e",
     "type":"auth","id":"_","route":{"client":"ui","login":"admin","hpw":"cc3c49ccc51e0bb804a695f67d9f4d29c7f476149d3e79e3455440a5c92f50e7","remember":0},"payload":{}}
  <= {"uuid":"855a9169-ef6b-41d6-a74f-55e906e7fd0e","type":"auth",
      "set":{"socketid":"vkxxK32V1Txiqkas7t+rog==","layout":"1","project":"miheev_ih","project_name":"miheev_ih","project_version":"5.5"},"response":1}
 * 
 * CHERRY 
   => {"name":"keys","uuid":"adc1dddd-af07-44d0-98d1-59ba73faf78a","type":"get","id":"_","short":"1"}
   <= {"id":"_","uuid":"adc1dddd-af07-44d0-98d1-59ba73faf78a","data":{"serverkey":"UR2Sh2Bv6UOvpoB9Rzg6QQ==","p2pkey":""},"response":1}

   => {"name":"filterlists","mtime":1629829018654,"uuid":"cd25a259-d6bf-4d96-9a75-961bc211fc48","type":"get","id":"_","short":"1"}
   <= {"uuid":"cd25a259-d6bf-4d96-9a75-961bc211fc48",
        "data":{"places":[{"id":"4","name":"Территория"},{"id":"5","name":"ГРЩ - АБК"},{"id":"6","name":"Шкаф управления"}],
                 "rooms":[{"id":"1","name":"(5) Переговорная"},{"id":"2","name":"(6) Кабинет"},{"id":"3","name":"(7) МедКабинет"},{"id":"4","name":"(8) Кофепоинт"}
                 "subsystems":[{"id":"1","name":"Освещение"},{"id":"2","name":"Климат"},{"id":"3","name":"Безопасность"},{"id":"4","name":"Прочее"}]},
                 "mtime":1581149117907,"response":1}

  => {"name":"devices","mtime":null,"sub":"1","uuid":"d6d01616-ea69-4d5a-834e-8ef2686f50a1",
       "type":"get","id":"_","short":"1"}

  => {"name":"devices","mtime":null,"sub":"1","uuid":"c384db16-b1a6-4dad-b0ae-bb4e002ce81c","type":"get","id":"_","short":"1"}
  <= {"data":{"DL5":{"stval":0,"err":"empty","wmode":"empty","aval":"5416"},"DL6":{"stval":0,"err":"empty","wmode":"empty","aval":"16956"},"DL7":{"stval":0,"err":"empty","wmode":"empty","aval":"32764"},"DL8":{"stval":0,"err":"empty","wmode":"empty","aval":"10344"},"DL9":{"stval":0,"err":"empty","wmode":"empty","aval":"7832"}

   => {"name":"deviceslist","mtime":1568802150140,"uuid":"107f7e45-734a-4cc8-ac4b-bc11de16982a",
      "type":"get","id":"_","short":"1"}

  => {"name":"deviceslist","mtime":1629829018691,"uuid":"b02d9f4e-aa8d-4a7d-9a57-fd7e4ecf2070","type":"get","id":"_","short":"1"}
  <= {"data":[
    {"id":"RESET_16","name":"Перезагрузка шкафа управления 16","cl":"ActorD","top":0,"type":"500","place":"6","room":"","subs":"",
     "images":[{"img":"reset110.svg","imgColor":"rgba(112, 112, 112, 1)"},
               {"img":"reset110.svg","imgColor":"rgba(189, 0, 0, 1)"}],
               "disdsonoff":0,
               "hasDefval":0,"max":0,"min":0,"step":1},
    {"id":"RESET_26","name":"Перезагрузка шкафа управления 26","cl":"ActorD","top":0,"type":"500","place":"6","room":"","subs":"","images":[{"img":"reset110.svg","imgColor":"rgba(112, 112, 112, 1)"},{"img":"reset110.svg","imgColor":"rgba(189, 0, 0, 1)"}],"disdsonoff":0,"hasDefval":0,"max":0,"min":0,"step":1},{"id":"RESET_308","name":"Перезагрузка шкафа управления 308","cl":"ActorD","top":0,"type":"500","place":"6","room":"","subs":"","images":[{"img":"reset110.svg","imgColor":"rgba(112, 112, 112, 1)"},{"img":"reset110.svg","imgColor":"rgba(189, 0, 0, 1)"}],"disdsonoff":0,"hasDefval":0,"max":0,"min":0,"step":1},

   => {"name":"devicesimagelist","mtime":1568975555539,"uuid":"8af123f6-b384-48d7-83ca-ded99e7bd0ba",
      "type":"get","id":"_","short":"1"}

   => {"name":"devicesimagelist","mtime":1629830097657,"uuid":"0aab6c55-a391-4351-b7e6-9bef82b7bc35","type":"get","id":"_","short":"1"}
   <= {"data":[
        {"img":"_ih_actuator_d_off.svg","mtime":1527612934000},
        {"img":"_ih_actuator_d_on.svg","mtime":1527612934000},
        {"img":"_ih_dev_a.svg","mtime":1527612934000},
        {"img":"_ih_door_sensor.svg","mtime":1527612934000},
        {"img":"_ih_heat_b.svg","mtime":1527612934000}],
        "ts":1629832968684,"mtime":1629832968684,"response":1}

  => {"name":"pushnotifications","uuid":"fedf0c0c-88fa-4847-a529-bb85178c7ec9",
      "type":"check","id":"_","short":"1"}
 <= {"id":"_","uuid":"fedf0c0c-88fa-4847-a529-bb85178c7ec9","mtime":0,"response":1}

=> {"name":"pushnotification","hwid":"25ba4cefb3a5f9d4","model":"SM-J250F",
    "token":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x",
    "uuid":"5380958a-af2a-4d8e-a15c-925207833aab",
    "type":"register","id":"_","short":"1"}

 <= {"0":{"id":"4","infotype":"pushnotification","user":"13","group":"","hwid":"25ba4cefb3a5f9d4",
    "addr":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x",
    "allowed":1,"sign":"","model":"SM-J250F","txt":"","_status":{"op":"add"},"user_login":"sysadmin"},
    "id":"_","uuid":"5380958a-af2a-4d8e-a15c-925207833aab","response":1}


   => {"name":"pushnotifications","uuid":"d1678796-872d-4696-b490-c00f50779226",
       "type":"check","id":"_","short":"1"}

   => {"name":"pushnotification","hwid":"25ba4cefb3a5f9d4","model":"SM-J250F",
      "token":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x",
      "uuid":"580ff75c-1cc7-4308-9e56-a78b148349df",
      "type":"register","id":"_","short":"1"}


  =>    {"uuid":"5610f488-32f7-47fb-b1d8-49abbea75d4d","type":"action","id":"_",
         "route":{"dn":"H004_1","act":"toggle","stval":1},"payload":{}}
  

 */

const util = require('util');

const appconfig = require('../appconfig');
const auth = require('./auth');
const hut = require('../utils/hut');
const commander = require('../domain/commander');
const domaindata = require('../domain/domaindata');
const liststore = require('../dbs/liststore');
const deviceutil = require('../device/deviceutil');
const widgetdata = require('../domain/widgetdata');

async function processMessage(client, message, holder) {
  // console.log('wsmobile client.user='+util.inspect(client.user))
  if (message.indexOf('connect') >= 0) {
    send('connect:connected');
    return;
  }

  let mes;
  let res;
  let error;
  try {
    mes = JSON.parse(message);
    // console.log('=> ' + message);
    if (mes.type == 'auth') {
      res = await authResult();
    } else {
      // console.log('client.token='+client.token)
      if (!client.token) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDTOKEN') };

      switch (mes.type) {
        case 'get':
          if (mes.route) {
            // Запрос на данные одного устройства - журнал, настройки
            res = await getResultForRoute(mes.route);
          } else {
            res = await getResult(mes.name);
          }
          break;

        // => {"id":"_","type":"check", "name":"pushnotifications","uuid":"fedf0c0c-88fa-4847-a529-bb85178c7ec9"}
        // <= {"id":"_","uuid":"fedf0c0c-88fa-4847-a529-bb85178c7ec9","mtime":0,"response":1}
        // Вернуть mtime - время последнего сообщения для этого клиента?
        case 'check':
          res = await getPushnotifications({ userId: client.user._id, check: true });
          break;

        // => {"type":"register","id":"_","name":"pushnotification","hwid":"25ba4cefb3a5f9d4","model":"SM-J250F",
        //   "token":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x",
        // <= {"id":"_","uuid":"5380958a-af2a-4d8e-a15c-925207833aab","response":1}

        case 'register':
          res = await updatePnsKeys();
          break;

        case 'action':
          res = await getActionResult();
          if (res && res.err) throw { message: res.err };
          break;

        case 'command':
          await getCommandResult();
          // if (res.error) throw { message: res.error };
          break;

        default:
          throw { message: 'Unknown type ' + mes.type };
      }
    }
  } catch (e) {
    error = e;
  }

  // client.ws.send(JSON.stringify(formResponse(mes, res, error)));
  send(formResponse(mes, res, error));

  function send(obj) {
    let str = typeof obj == 'object' ? JSON.stringify(obj) : String(obj);
    client.ws.send(str);
    // console.log('<= ' + str);
  }

  function formResponse(inobj, outobj, err) {
    let robj = {};
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

  /**
   * Получены данные регистрации для pushnotification
   * Если нет еще записи для этой учетки - добавить
   */
  async function updatePnsKeys() {
    const { hwid, token, model } = mes;

    if (!hwid) throw { message: 'Expected hwid for type:register' };
    if (!token) throw { message: 'Expected token for type:register' };

    // Могут быть записи для разных учеток - вход с одного телефона с разными учетками?
    const docs = await holder.dm.get('infoaddr', { infotype: 'pushnotification', hwid });
    let found;
    if (docs.length) {
      // Заменить токен для этого hwid - он может измениться
      await holder.dm.dbstore.update(
        'infoaddr',
        { infotype: 'pushnotification', hwid },
        { $set: { addr: token } },
        { multi: true }
      );
      docs.forEach(doc => {
        if (doc.userId == client.user._id) found = true;
      });
    }
    // Если нет еще записи для этой учетной записи - добавить
    if (!found) {
      const newDoc = { infotype: 'pushnotification', userId: client.user._id, hwid, model, addr: token, allowed: 1 };
      await holder.dm.insertDocs('infoaddr', [newDoc]);
    }
  }

  //  {"type":"action","id":"_", "route":{"dn":"H004_1","act":"toggle","stval":1},"payload":{}}
  async function getActionResult() {
    // console.log('getActionResult '+util.inspect(mes.rout))
    let { dn, act, stval, prop, value } = mes.route;
    if (!dn) throw { message: 'Expected route.dn' };

    const dobj = holder.dnSet[dn];
    if (!dobj) throw { message: 'Device not found:' + dn };

    const sender = 'user: ' + client.user.name + ' (mobile)';

    let result;
    // Команда - act
    if (act) {
      prop = act;
      if (act == 'toggle') {
        prop = stval == 1 ? 'off' : 'on';
      }
      prop = getMappedCommand(dobj, act); // Выполнить маппинг команды
      if (prop) {
        result = commander.execDeviceCommand(sender, { did: dobj._id, prop }, holder);
      } else {
        result = { err: 'No command ' + act + ' for device ' + dn };
      }
      return result;
      // if (result.error) return result;
      // return { type: 'sub', data: [{ data: { [dn]: { stval: prop == 'on' ? 1 : 0 } } }] };
    }

    if (prop && value != undefined) {
      // Присвоить значение свойству
      const mprop = isMappedProp(prop) ? getMappedCommand(dobj, prop) : prop;
      if (mprop) {
        result = commander.execSet(sender, { did: dobj._id, prop: mprop, value }, holder);
      } else {
        result = { err: 'No mapped prop ' + prop + ' for device ' + dn };
      }
      return result;
    }
  }

  function isMappedProp(prop) {
    return ['defval', 'stval', 'aval'].includes(prop);
  }

  function getMappedCommand(dobj, inprop) {
    const mobileTypeItem = liststore.getItemFromList('mobiletypeList', dobj.type);
    if (mobileTypeItem && mobileTypeItem[inprop]) {
      return mobileTypeItem[inprop];
    }
  }

  //  {"type":"command","id":"scen003", "command":"scene"}
  async function getCommandResult() {
    if (mes.command == 'scene' || mes.command == 'script') {
      if (!mes.id) throw { message: 'Expected scene id' };

      const scene = holder.sceneSet[mes.id];
      if (!scene) throw { message: 'Сценарий не найден!' };

      if (scene.blk) throw { message: 'Сценарий заблокирован!' };
      holder.emit('start:scene', mes.id);
      return;
    }
    throw { message: 'Unknown command: ' + mes.command };
  }

  async function authResult() {
    const result = { noencrypt: 1 };
    const user = await auth.getUserByLogin(mes.route.login, mes.route.hpw);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
    client.user = user;
    // Одноразовый токен сохранять не нужно
    result.token = auth.createOneTimeToken(mes.login);

    client.token = result.token;
    return result;
  }

  async function getResultForRoute(route) {
    const { tablename } = route;
    switch (tablename) {
      case 'devsettings':
        return devsetting(route);

      case 'devicesettingsV5':
        return devicesettingsV5(route);
      default:
        throw { message: 'Unknown tablename!' };
    }
  }

  async function devicesettingsV5(route) {
    const { dn } = route;
    const dobj = holder.dnSet[dn];
    if (!dobj) throw { message: 'Device not found:' + dn };
    const data = await widgetdata.getMobileWidgetdata('devicesettingsV5', dobj, holder);

    if (!data) throw { message: 'Not found devicesettings for ' + dn };
    return { data };
  }

  async function devsetting(route) {
    const { dn } = route;
    const dobj = holder.dnSet[dn];
    if (!dobj) throw { message: 'Device not found:' + dn };

    // Журнал устройства
    const arr = await holder.dm.datagetter.getVirttable('devicelogTable', {}, 'devicelog', dobj._id, '', holder);

    const logarr = arr
      .map(item => ({
        time: item.ts > 0 ? hut.getDateTimeFor(new Date(item.ts), 'shortdt') : '',
        text: deviceutil.getLogMessage(dobj, item),
        ts: item.ts
      }))
      .filter(item => item.text && item.time && item.ts);

    // Возвращается 3 вкладки для devsetting V4, мобильный использует только tab2 с журналом
    const tab2 = [{ id: 'tab2', size: 1, childs: [{ type: 'timeline', size: 1, param: logarr }] }];
    // tab2.push({ id: ts, size: 1, childs: [{ type: 'timeline', size: 1, param: logarr }] });
    return {
      id: '_',
      set: {
        data: {
          header: 'Header: ' + dn,
          footer: '',
          tabs: [
            { name: '', icon: 'ui_cntrl', data: [] },
            { name: 'PARAMETERS', icon: 'ui_param', data: [] },
            { name: 'LOG', icon: 'ui_log', data: tab2 }
          ]
        }
      }
    };
  }

  /**
   * Было в V4 Мобильный использует только третью вкладку
  const res = {
    id: '_',
    uuid: 'ee07c325-0c9c-445f-b599-f12c741dbfc0',
    set: {
      data: {
        header: 'LAMP_2_2\r\nСветильник\r\n2 этаж/ Детская',
        footer: '',
        tabs: [
          {
            name: '',
            icon: 'ui_cntrl',
            data: [
              {
                id: '0',
                size: 50,
                childs: [
                  { type: 'button', size: 1, param: { act: 'on', name: 'Включить' } },
                  { type: 'button', size: 1, param: { act: 'off', name: 'Выключить' } }
                ]
              },
              { id: '1', size: 20, childs: [{ type: 'divider', size: 1, param: {} }] }
            ]
          },
          {
            name: 'Параметры',
            icon: 'ui_param',
            data: [
              {
                id: '2',
                size: 60,
                childs: [
                  {
                    type: 'cb',
                    size: 1,
                    align: 'flex-start',
                    param: { prop: 'auto', value: false, name: 'Автоматический режим (АВТО)' }
                  }
                ]
              },
              {
                id: '3',
                size: 40,
                childs: [{ type: 'text', size: 1, align: 'stretch', param: { text: 'Восстанавливать АВТО через' } }]
              },
              {
                id: '4',
                size: 30,
                childs: [
                  { type: 'time', size: -1, align: 'flex-start', param: { prop: 'retime_on', value: 300 } },
                  { type: 'text', size: 1, align: 'flex-start', param: { text: 'после ручного включения' } }
                ]
              },
              {
                id: '5',
                size: 30,
                childs: [
                  { type: 'time', size: -1, align: 'flex-start', param: { prop: 'retime_off', value: 30 } },
                  { type: 'text', size: 1, align: 'flex-start', param: { text: 'после ручного выключения' } }
                ]
              },
              {
                id: '6',
                size: 60,
                childs: [{ type: 'text', size: 1, align: 'stretch', param: { text: '00:00:00 - АВТО не отключается' } }]
              },
              { id: '7', size: 20, childs: [{ type: 'divider', size: 1, param: {} }] }
            ]
          },
          {
            name: 'Журнал',
            icon: 'ui_log',
            data: [
              {
                id: '8',
                size: 1,
                childs: [
                  {
                    type: 'timeline',
                    size: 1,
                    param: [
                      { time: '23.09 08:32:16', text: 'Выключено', ts: 1632382336719 },
                      { time: '23.09 08:32:16', text: 'Команда: toggle \n login: admin', ts: 1632382336719 },
                      { time: '23.09 08:32:15', text: 'Включено', ts: 1632382335840 },
                      { time: '23.09 08:32:15', text: 'Команда: toggle \n login: admin', ts: 1632382335840 },
                      { time: '23.09 08:32:14', text: 'Выключено', ts: 1632382334891 },
                      { time: '23.09 08:32:14', text: 'Команда: toggle \n login: admin', ts: 1632382334890 },
                      { time: '23.09 08:32:13', text: 'Включено', ts: 1632382333804 },
                      { time: '23.09 08:32:13', text: 'Команда: toggle \n login: admin', ts: 1632382333801 }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    response: 1
  };
   */

  async function getResult(name) {
    const ts = Date.now();
    let result = { mtime: ts };
    switch (name) {
      case 'keys':
        result.data = { serverkey: appconfig.get('hwid'), p2pkey: domaindata.getP2pKey(holder) };
        break;

      case 'devices':
        if (mes.uuid && mes.sub) {
          client.subs.set(mes.uuid, { type: 'mobile_devices' });
        }
        result.data = await getDevicesState();
        /*
       
        result.data = {
          H001_2: { stval:1, err: 'empty', wmode: 'empty' }
        };
        */
        /*
        {"uuid":"37c230c9-13b3-4188-9bb2-9a3ac83b695c","mtime":1631098691867,"data":{"H104_1":{"stval":1,"err":"empty","wmode":"empty"}},"response":1}
        */
        break;

      // Те запросы, которые м б кэшированы - возвращают result = {mtime, data}
      case 'filterlists':
        result = await getFilterlists();
        break;

      case 'scenes':
        result = await getScenes();
        break;

      case 'deviceslist':
        result = getOneList('mobile_deviceslist');
        // result.data = holder.dm.getFromCache('mobile_deviceslist').data;
        /**
         * <= {"uuid":"a4c8c859-ab99-46f0-96c5-3f598dadcdf0","mtime":1631098691868,"data":[{"id":"H104_1","name":"Светильники потолочные точечные","cl":"ActorD","top":0,"type":"500","place":"dg002","room":"dg006","subs":"свет","images":[{"img":"lamp0010.svg","imgColor":"transparent"},{"img":"lamp0010.svg","imgColor":"rgba(245, 228, 48, 1)"}],"disdsonoff":0,"hasDefval":0,"max":0,"min":0,"step":1}],"response":1}
         */
        /*
        result.data = [
          {
            id: 'H104_1',
            name: 'Светильники потолочные точечные',
            cl: 'ActorD',
            top: 0,
            type: '500',
            place: 'dg002',
            room: 'dg006',
            subs: 'свет',
            images: [
              { img: 'lamp0010.svg', imgColor: 'transparent' },
              { img: 'lamp0010.svg', imgColor: 'rgba(245, 228, 48, 1)' }
            ],
            disdsonoff: 0,
            hasDefval: 0,
            max: 0,
            min: 0,
            step: 1
          }
        ];
        */

        break;

      case 'devicesimagelist':
        result = getOneList('mobile_devicesimagelist');
        // result.data = holder.dm.getFromCache('mobile_devicesimagelist').data;
        // {"uuid":"6c","mtime":1631099684554,"data":[{"img":"lamp0010.svg","mtime":1631099684554},{"img":"temp1010.svg","mtime":1631099684554}],"

        break;

      case 'pushnotifications':
        result = await getPushnotifications({ userId: client.user._id });
        break;

      case 'cameras':
        result.data = await getCameras();
        break;

      default:
        error = 'Unknown get name ' + name;
    }
    return result;
  }

  async function getOneList(listKey) {
    let mtime = getMaxMtime([listKey]);
    if (mtime && mes.mtime && mtime <= mes.mtime) return { mtime };
    return {
      mtime,
      data: holder.dm.getFromCache(listKey).data
    };
  }

  async function getScenes() {
    let mtime = getMaxMtime(['mobile_scenegroups', 'mobile_scenes']);
    if (mtime && mes.mtime && mtime <= mes.mtime) return { mtime };

    const scenegroups = holder.dm.getFromCache('mobile_scenegroups').data;
    const scenelist = holder.dm.getFromCache('mobile_scenes').data;
    return {
      mtime,
      data: {
        scenegroups,
        scenelist
      }
    };
  }

  async function getDevicesState() {
    const data = holder.dm.getFromCache('mobile_deviceslist').data;
    const result = {};
    data.forEach(item => {
      const dobj = holder.dnSet[item.id];

      if (dobj) {
        const mobileTypeItem = liststore.getItemFromList('mobiletypeList', dobj.type);
        if (mobileTypeItem) {
          result[item.id] = {
            stval: getStval(dobj, mobileTypeItem.stval),
            err: 'empty',
            wmode: 'empty'
          };
          if (mobileTypeItem.cl == 'SensorA' || mobileTypeItem.cl == 'ActorA') {
            // Аналоговое значение отдавать как строку??
            result[item.id].aval = getAval(dobj, mobileTypeItem.aval);
          }

          // const stval = getMappedValue(dobj, mobileTypeItem, 'stval');
          // const aval = getMappedValue(dobj, mobileTypeItem, 'aval');

          // result[item.id] = { stval, aval, err: 'empty', wmode: 'empty' };
        }
      }
    });
    /*
  const dn = 'H104_1';
  const dobj = holder.dnSet[dn];
  const stval = dobj.state;
  result.data = {
    H104_1: { stval, err: 'empty', wmode: 'empty' }
  };
  */
    // console.log('mobile_deviceslist ' + util.inspect(result));
    return result;

    function getMappedValue(dobj, mobileTypeItem, v4prop) {
      if (mobileTypeItem[v4prop]) {
        return dobj[mobileTypeItem[v4prop]];
      }
    }
  }

  async function getCameras() {
    const arr = await holder.dm.dbstore.get('devhard', { unit: 'cctv' });
    return arr
      .filter(item => !item.folder)
      .sort(hut.byorder('order'))
      .map(item => {
        const { order, parent, did, prop, unit, chan, ...chobj } = item;
        return { ...chobj, id: chan };
      });
  }

  async function getPushnotifications({ userId, check = false }) {
    // const filter = { dest: userId };
    // if (mtime) filter.time = {$gt: mtime};
    // console.log('getPushnotifications userId='+userId)

    const arr = await holder.dm.dbstore.get('pushnotifications', { dest: userId }, { sort: { ts: -1 } });
    const mtime = arr.length ? arr[0].time : 0;

    const result = { mtime };
    if (!check) result.data = arr.filter(item => item.ts > 0).map(item => ({ ts: item.ts, txt: item.txt }));
    // console.log('getPushnotifications result='+util.inspect(result))

    return result;
  }

  async function getFilterlists() {
    let mtime = getMaxMtime(['mobile_places', 'mobile_rooms', 'mobile_subsystems']);
    if (mtime && mes.mtime && mtime <= mes.mtime) return { mtime };

    const places = holder.dm.getFromCache('mobile_places').data;
    const rooms = holder.dm.getFromCache('mobile_rooms').data;
    const subsystems = holder.dm.getFromCache('mobile_subsystems').data;
    // const scenegroups = holder.dm.getFromCache('mobile_scenegroups').data;
    return {
      mtime,
      data: {
        places,
        rooms,
        subsystems
      }
    };
    /*
    return {
      places: [{ id: '1', name: '1 этаж' }],
      rooms: [{ id: '104', name: 'Холл', place: '1' }],
      subsystems: [
        { id: '1', name: 'Свет' },
        { id: '2', name: 'Климат' }
      ],
      scenegroups:[
        {id:'Root', name: 'Общие'},
        {id:'Свет', name: 'Свет'}
        ]
    };
    */
  }

  function getMaxMtime(keyArr) {
    let maxMtime = 0;
    keyArr.forEach(key => {
      const ts = holder.dm.getCacheTs(key);
      if (ts > maxMtime) maxMtime = ts;
    });
    return maxMtime;
  }
}

function getStval(dobj, prop) {
  return prop ? dobj[prop] || 0 : 0;
}

function getAval(dobj, prop) {
  if (!prop) return '';
  const propString = prop + '#string';
  return dobj[propString] != undefined ? dobj[propString] : String(dobj[prop]);
}

function formOnSub(changed, holder) {
  let res;
  // console.log('formOnSub changed='+util.inspect(changed))
  changed.forEach(chItem => {
    const did = chItem.did;
    if (holder.devSet[did] && holder.devSet[did].mob) {
      const dobj = holder.devSet[did];
      const dn = dobj.dn;
      const mobileTypeItem = liststore.getItemFromList('mobiletypeList', dobj.type);
      if (mobileTypeItem) {
        const prop = chItem.prop;
        if (mobileTypeItem.stval == prop) {
          if (!res) res = {};
          if (!res[dn]) res[dn] = {};
          res[dn].stval = getStval(dobj, prop);
        } else if (mobileTypeItem.aval == prop) {
          if (!res) res = {};
          if (!res[dn]) res[dn] = {};
          res[dn].aval = getAval(dobj, prop);
        }
      }
    }
  });
  return res ? { type: 'sub', data: [{ data: res }] } : '';
}

module.exports = {
  processMessage,
  formOnSub
};

// {"uuid":"517255ec","type":"auth","id":"_","route":{"client":"ui","login":"admin","hpw":"cc3c49ccc51e0bb804a695f67d9f4d29c7f476149d3e79e3455440a5c92f50e7","remember":0}}

// {"name":"pushnotification","hwid":"25ba4cefb3a5f9d4","model":"SM-J250F","token":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x","uuid":"538095","type":"register","id":"_"}
