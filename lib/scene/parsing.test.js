/* eslint-disable */

const util = require('util');
const expect = require('expect');
// const sinon = require('sinon');

const test = require('./parsing');

const script1 = `
/**
* @name Вентиляция по температуре
* @desc Сценарий включает вентилятор, если температура выше 30 градусов и выключает если ниже
* @version 4
*/

script ({
  start() {
    if (temp.aval > 30 && !vent.dval) {
      this.do(vent, 'on');
      this.sendSMS('Now VENT ON!');
    } 
  }
})`;

const script2 = `

script ({
  start() {
    if (temp.aval > 30 && !vent.dval) {
      this.do(vent, 'on');
      this.sendSMS('Now VENT ON!');
    } 
  }
})`;

const script3 = `
/** 
* @name Уведомление об остановке плагина 
* @desc  Запускается при удачном старте плагина, срабатывает при его остановке
* @version 4 
*/
const unit = Device("SensorD"); 
const lamp = Device("ActorD"); 

startOnChange(unit, unit.state > 0); 

script({
    start() {
      if (unit.state == 2) {
        this.log('Plugin '+unit.name+' has started.')
      } else {
         this.log('Plugin '+unit.name+' has stopped. laststart= '+unit.getParam('laststart'));
         
      }
    } 
});
`;

const scriptOldVer = `
/** 
* @name Свет по датчику движения АВТО 
* @desc Включает светильник по датчику движения, отключает при отсутствии движения в течение заданного времени 
*  Сценарий работает, если для устройства включен флаг АВТО
*/

const lamp = Device("ActorD", "Светильник", [
  {"name":"timeOff", "note":"Светильник горит без движения, сек", "type":"number", "val":5}
  ]); 
  
const motion = Device("SensorD", "Датчик движения");  

const script = {
    start() {
      lamp.on();
    }
  }`;

  const scriptOldVerDeviceT = `
  /** 
  * @name Свет по датчику движения АВТО 
  */
  
  const lamp = Device("ActorD",  [
    {"name":"timeOff", "note":"Светильник горит без движения, сек", "type":"number", "val":5}
    ]); 
    
  const motion = DeviceT("SensorD", "Датчик движения");  
  
  const script = {
    start() {
      lamp.on();
    }
  }`;

  const scriptRealDevice = `
  /** 
  * @name Свет по датчику движения АВТО 
  */
  
  const lamp = Device("Lamp1", [
    {"name":"timeOff", "note":"Светильник горит без движения, сек", "type":"number", "val":5}
    ]); 
    
  const motion = Device("DD1", "Датчик движения");  
  
  const script = {
    start() {
      lamp.on();
    }
  }`;
  
    
describe('sceneserver/sceneutils', () => {
  describe('selectCommentDescriptAndScript', () => {
    it('Empty script', () => {
      const str = '';
      const { comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      expect(comment).toEqual('');
      expect(descript).toEqual('');
      expect(scriptstr).toEqual('');
    });

    it('Not empty comment and script', () => {
      const str = script1;
      const { comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
     
      expect(comment.substr(0,3)).toEqual('/**');
      console.log('descript='+descript)
      expect(descript).toEqual('');
     
      expect(scriptstr.substr(0,6)).toEqual('script');
    });
    it('Not empty only script', () => {
      const str = script2;
      const { comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
   
      expect(comment).toEqual('');
      expect(descript).toEqual('');
      expect(scriptstr.substr(0,6)).toEqual('script');
    });

    it('Everything not empty', () => {
      const str = script3;
      const { comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      console.log('descript='+descript)
      expect(comment.substr(0,3)).toEqual('/**');
      expect(descript.substr(0,3)).toEqual('con');
      
      expect(scriptstr.substr(0,6)).toEqual('script');
    });

    it('Old ver, everything not empty', () => {
      const str = scriptOldVer;
      const { comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      console.log('scriptstr='+scriptstr)
      // expect(comment.substr(0,3)).toEqual('/**');
      // expect(descript.substr(0,3)).toEqual('con');
      
      // expect(scriptstr.substr(0,6)).toEqual('script');
    });
    
  });

  describe('parseComment', () => {
    it('With name, desc', () => {
      const str = script1;
      const { comment} = test.selectCommentDescriptAndScript(str);
      console.log('comment='+comment)
      const {name, version} = test.parseComment(comment);

      expect(name).toEqual('Вентиляция по температуре');
      

      expect(version).toEqual('4');
    });
  });

  describe('parseDevice', () => {
    it('Multi - unit, lamp', () => {
      const str = script3;
      const {  comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      // console.log('descript='+descript)
      
      // const {multi, devs, triggers, realdevs, def} = test.parseDevice(descript);
       const obj = test.parseDevice(descript);
       console.log(util.inspect(obj));

      expect(obj.multi).toEqual( 1);
      expect(obj.devs).toEqual( 'unit,lamp');
      expect(obj.triggers).toEqual('unit');
      expect(obj.realdevs).toEqual('');
      expect(Object.keys(obj.def)).toEqual(['unit', 'lamp']);

    });
    it('Multi - OldVer -  motion, lamp', () => {
      const str = scriptOldVer;
      const {  comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      // console.log('descript='+descript)
      
      // const {multi, devs, triggers, realdevs, def} = test.parseDevice(descript);
       const obj = test.parseDevice(descript);
       console.log(util.inspect(obj));

      expect(obj.multi).toEqual( 1);
      expect(obj.devs).toEqual('lamp,motion');
      expect(obj.triggers).toEqual('');
      expect(obj.realdevs).toEqual('');
      expect(Object.keys(obj.def)).toEqual(['lamp', 'motion']);

    });
    it('Multi - OldVerDeviceT -  motion, lamp', () => {
      const str = scriptOldVerDeviceT;
      const {  comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      // console.log('descript='+descript)
      
      // const {multi, devs, triggers, realdevs, def} = test.parseDevice(descript);
       const obj = test.parseDevice(descript);
       console.log(util.inspect(obj));

      expect(obj.multi).toEqual( 1);
      expect(obj.devs).toEqual('lamp,motion');
      expect(obj.triggers).toEqual('motion');
      expect(obj.realdevs).toEqual('');
      expect(Object.keys(obj.def)).toEqual(['lamp', 'motion']);

      expect(typeof obj.extprops).toEqual('object');
      expect(Object.keys(obj.extprops)).toEqual(['lamp']);
    });

    it('Not Multi - scriptRealDevice -  motion, lamp', () => {
      const str = scriptRealDevice;
      const {  comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      // console.log('descript='+descript)
      
      // const {multi, devs, triggers, realdevs, def} = test.parseDevice(descript);
       const obj = test.parseDevice(descript);
       console.log(util.inspect(obj));

      expect(obj.multi).toEqual( 0);
      expect(obj.devs).toEqual('lamp,motion');
      expect(obj.triggers).toEqual('');
      expect(obj.realdevs).toEqual('Lamp1,DD1');
      expect(typeof obj.def).toEqual('object');
      expect(obj.def).toEqual({lamp:'Lamp1', motion:'DD1'});
     
    });
  });
});
