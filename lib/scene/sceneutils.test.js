/* eslint-disable */

const util = require('util');
const expect = require('expect');
// const sinon = require('sinon');

const test = require('./sceneutils');

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
  
    // Запустим сценарий, ЕСЛИ
    // флаг светильника Авто установлен 
    // и светильник не горит и есть движение - тогда включим лампу 
    // или светильник горит (чтобы выключить, так как режим Авто)
  
    check() {
        return ((lamp.auto == 1) && ((lamp.dval == 0) && (motion.dval == 1) || (lamp.dval > 0)));  
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
      const {name, description, version} = test.parseComment(comment);

      expect(name).toEqual('Вентиляция по температуре');
      expect(description.substr(0,8)).toEqual('Сценарий');

      expect(version).toEqual('4');
    });
  });

  describe('parseDescript', () => {
    it('With name, desc', () => {
      const str = script3;
      const {  comment, descript, scriptstr } = test.selectCommentDescriptAndScript(str);
      console.log('descript='+descript)
      
      test.parseDescript(descript);

      // expect(name).toEqual('Вентиляция по температуре');
      // expect(description.substr(0,8)).toEqual('Сценарий');

      // expect(version).toEqual('4');
    });
  });
});
