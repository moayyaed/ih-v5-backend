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
 * 
 * => {"name":"keys","uuid":"27299ca6-fcfc-4d5b-9105-4f654289a020",
 *    "type":"get","id":"_","short":"1"}
 *     { data: { serverkey: appconfig.get('serverkey')???, p2pkey: cg.getP2Pkey()??? } };
 * 
 * CHERRY 
   => {"name":"keys","uuid":"adc1dddd-af07-44d0-98d1-59ba73faf78a","type":"get","id":"_","short":"1"}
   <= {"id":"_","uuid":"adc1dddd-af07-44d0-98d1-59ba73faf78a","data":{"serverkey":"UR2Sh2Bv6UOvpoB9Rzg6QQ==","p2pkey":""},"response":1}

   
   => {"name":"filterlists","mtime":1567597468800,"uuid":"7340f36a-c044-4729-8483-1a251a73bc43",
      "type":"get","id":"_","short":"1"}

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

const appconfig = require('../appconfig');
const auth = require('./auth');
const commander = require('../appspec/commander');
const domaindata = require('../domain/domaindata');

module.exports = async function(client, message, holder) {
  // console.log('wsmobile '+message)
  if (message.indexOf('connect') >= 0) {
    send('connect:connected');
    return;
  }

  let mes;
  let res;
  let error;
  try {
    mes = JSON.parse(message);
    switch (mes.type) {
      case 'auth':
        res = await authResult();
        break;

      case 'get':
        res = await getResult(mes.name);
        break;
      case 'check':
      case 'register':
        break;
      case 'action':
        res = await getActionResult();
        if (res.error) throw { message: res.error };
        break;

      default:
        throw { message: 'Unknown type ' + mes.type };
    }
  } catch (e) {
    error = e;
  }

  // client.ws.send(JSON.stringify(formResponse(mes, res, error)));
  send(formResponse(mes, res, error));

  function send(obj) {
    let str = typeof obj == 'object' ? JSON.stringify(obj) : String(obj);
    client.ws.send(str);
    console.log('<= ' + str);
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

  //  {"type":"action","id":"_", "route":{"dn":"H004_1","act":"toggle","stval":1},"payload":{}}
  async function getActionResult() {
    const dn = mes.route.dn;
    if (!dn) throw { message: 'Expected route.dn' };

    const dobj = holder.dnSet[dn];
    if (!dobj) throw { message: 'Device not found:' + dn };
    let prop = mes.route.stval ? 'off' : 'on';
    console.log('EXEC ' + dobj._id + ' ' + prop);

    //  Сразу вернуть по подписке
    // {"data":[
    // {"data":{"LAMP1":{"stval":1,"wmode":"reauto"}},"uuid":1}
    // ],"type":"sub","response":1}
    let result;
    result = commander.execDeviceCommand('Native client', { did: dobj._id, prop }, holder);
    if (result.error) return result;

    return { type: 'sub', data: [{ data: { [dn]: { stval: prop == 'on' ? 1 : 0 } } }] };
  }

  async function authResult() {
    const result = { noencrypt: 1 };
    const user = await auth.getUserByLogin(mes.route.login, mes.route.hpw);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
    client.user = user;
    result.token = auth.createNewToken(mes.login);
    return result;
  }

  async function getResult(name) {
    const ts = Date.now();
    const result = { mtime: ts };
    switch (name) {
      case 'keys':
        result.data = { serverkey: appconfig.get('hwid'), p2pkey: domaindata.getP2pKey(holder) };
        break;

      case 'filterlists':
        result.data = await getFilterlists();
        break;

      case 'devices':
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

      case 'deviceslist':
        result.data = holder.dm.getFromCache('mobile_deviceslist').data;
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
        result.data = holder.dm.getFromCache('mobile_devicesimagelist').data;
        /*
        result.data = [
          { img: 'lamp0010.svg', mtime: ts },
          { img: 'temp1010.svg', mtime: ts }
        ];
        */
        // {"uuid":"6c","mtime":1631099684554,"data":[{"img":"lamp0010.svg","mtime":1631099684554},{"img":"temp1010.svg","mtime":1631099684554}],"
        
        break;

      case 'pushnotifications':
        result.data = [];
        break;

      case 'cameras':
        result.data = await getCameras();
        break;

      default:
        error = 'Unknown get name ' + name;
    }
    return result;
  }

  async function getDevicesState() {
    const data = holder.dm.getFromCache('mobile_deviceslist').data;
    const result = {};
    data.forEach(item => {
      const dobj = holder.dnSet[item.id];
      if (dobj) {
        result[item.id] = { stval: dobj.state, err: 'empty', wmode: 'empty' };
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
    return result;
  }

  async function getCameras() {
    const arr = await holder.dm.dbstore.get('devhard', { unit: 'cctv' });
    return arr
      .filter(item => !item.folder)
      .map(item => {
        const { order, parent, did, prop, unit, chan, ...chobj } = item;
        return { ...chobj, id: chan };
      });
  }
  async function getFilterlists() {
    const places = holder.dm.getFromCache('mobile_places').data;
    const rooms = holder.dm.getFromCache('mobile_rooms').data;
    const subsystems = holder.dm.getFromCache('mobile_subsystems').data;
    return {
      places,
      rooms,
      subsystems
    };
    /*
    return {
      places: [{ id: '1', name: '1 этаж' }],
      rooms: [{ id: '104', name: 'Холл', place: '1' }],
      subsystems: [
        { id: '1', name: 'Свет' },
        { id: '2', name: 'Климат' }
      ]
    };
    */
  }
};
