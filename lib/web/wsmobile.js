/**
 *  WSS url=/backend - connection
 * => connect
 * <= connect:connected
 * => {"uuid":"517255ec-e20d-41b0-99fa-5b4075e792d7",
 *   "type":"auth","id":"_",
 *   "route":{"client":"ui","login":"admin",
 *   "hpw":"cc3c49ccc51e0bb804a695f67d9f4d29c7f476149d3e79e3455440a5c92f50e7",
 *   "remember":0},"payload":{}}
 * <= {"uuid":"517255ec-e20d-41b0-99fa-5b4075e792d7",
 *     "noenctypt":1,
 *     "token":...  
 * 
 * 
 * 
 * => {"name":"keys","uuid":"27299ca6-fcfc-4d5b-9105-4f654289a020",
 *    "type":"get","id":"_","short":"1"}
 *     { data: { serverkey: appconfig.get('serverkey')???, p2pkey: cg.getP2Pkey()??? } };
}
 * 

   => {"name":"filterlists","mtime":1567597468800,"uuid":"7340f36a-c044-4729-8483-1a251a73bc43",
      "type":"get","id":"_","short":"1"}

   => {"name":"devices","mtime":null,"sub":"1","uuid":"d6d01616-ea69-4d5a-834e-8ef2686f50a1",
       "type":"get","id":"_","short":"1"}

   => {"name":"deviceslist","mtime":1568802150140,"uuid":"107f7e45-734a-4cc8-ac4b-bc11de16982a",
      "type":"get","id":"_","short":"1"}

   => {"name":"devicesimagelist","mtime":1568975555539,"uuid":"8af123f6-b384-48d7-83ca-ded99e7bd0ba",
      "type":"get","id":"_","short":"1"}

   => {"name":"pushnotifications","uuid":"d1678796-872d-4696-b490-c00f50779226",
       "type":"check","id":"_","short":"1"}

   => {"name":"pushnotification","hwid":"25ba4cefb3a5f9d4","model":"SM-J250F",
      "token":"f8eI89aC-r0:APA91bETQcbiuMaapzx1IO6GsRE7f8DphLNSQ_R9NKfIbTvioQYtYYp4zwfc_M9_PoIvFEjTEJURa_i4Da9o-2O61KU2Kg8bf80z3vlgiaf2EZDLalfaT6mNumur1-FYrAygi_OvDj8x",
      "uuid":"580ff75c-1cc7-4308-9e56-a78b148349df",
      "type":"register","id":"_","short":"1"}

 */

 function processMessage(clid, mes, holder) {
   if (mes.type == 'get') {
     return get(mes.name);
   }

   function get(name) {
     const ts = Date.now();
     const res = {uuid:mes.uuid, response:1, mtime: ts};
    switch (name) {
      case 'keys': 
      res.data = { serverkey: '12345', p2pkey: '487949516'} ;
      break;

      case 'filterlists': 
      res.data = {places:[{id:"1", name:"1 этаж"}], rooms: {id:"1", name:"Гостиная", place:"1"}} ;
      break;

      default: res.response = 0;
      res.error = 'Unknown get name '+name;
    }
    return res;
   }
 }

module.exports = {
  processMessage
}