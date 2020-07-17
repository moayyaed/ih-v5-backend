/* eslint-disable */

const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const test = require('./sceneutils');

const script1 = `
/** 
* @name Свет по датчику движения АВТО с учетом аналоговой освещенности  
* @desc Включает светильник по датчику движения
*/

const lamp = Device("ActorD", "Светильник", [
  {"name":"timeOff", "note":"Светильник горит без движения, сек", "type":"number", "val":300},
  {"name":"takeDarkness", "note":"Учитывать освещенность", "type":"cb", "val":0},
  {"name":"levelDarkness", "note":"Порог освещенности", "type":"number", "val":5000}
]); 
  
const motion = Device("SensorD", "Датчик движения");  
const lightSensor = Device("SensorA", "Датчик аналоговой освещенности");  

const script = {
    start() {
          this.do(lamp, "aon");
    }
};`;

const fut = require('../utils/fileutil');
const appconfig = require('../appconfig');

describe('scene/sceneutils', () => {
  before(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(fut, 'getModifyTimeMs').returns(Date.now());
    sandbox.stub(fut, 'writeFileP').resolves();
    sandbox.stub(fut, 'readFileP').resolves(script1);
    sandbox.stub(fut, 'readdirP').resolves(['script1.js']);

    sandbox.stub(appconfig, 'getScriptFilename').returns('script/script1');
    sandbox.stub(appconfig, 'getReqScriptFilename').returns('req/script1');
    sandbox.stub(appconfig, 'getScriptPath').returns('script');
  });
  after(() => {
    sandbox.restore();
  });

  describe('processScriptStr', () => {
    it('throw with empty str', () => {
      // processScriptStr(scriptStr
      // const result = await test.update(body);
      expect.hasAssertions();
      try {
        test.processScriptStr();
      } catch (error) {
        expect(typeof error).toEqual('object');
        // expect(error).toBeInstanceOf(TypeError);
        expect(error).toHaveProperty('message', 'Empty script!');
      }
      /*
      const t = () => {
        throw new TypeError();
      };
      expect(t).toThrow(TypeError);
      */
    });

    it('process script1', () => {
      const res = test.processScriptStr(script1);
      console.log('script1 = ' + util.inspect(res));
      checkScript1(res);
      expect(typeof res.reqScript).toEqual('string');
      /*
  {
  name: 'Свет по датчику движения АВТО с учетом аналоговой освещенности ',
  multi: 1,
  devs: 'lamp,motion,lightSensor',
  triggers: '',
  realdevs: '',
  checkStr: undefined,
  def: {
    lamp: { cl: 'ActorD', note: 'Светильник' },
    motion: { cl: 'SensorD', note: 'Датчик движения' },
    lightSensor: { cl: 'SensorA', note: 'Датчик аналоговой освещенности' }
  },
  extprops: { lamp: [ [Object], [Object], [Object] ] },
  reqScript: 'module.exports = function ...' 

  }
  */
    });
  });

  describe('processScriptFile', async () => {
    it('process script1 as file', async () => {
      // sinon.stub(fut, 'readFileP').resolves(script1);
      const res = await test.processScriptFile('script1');
      console.log('script as file = ' + util.inspect(res));
      checkScript1(res);
    });
  });

  /*
  describe('isScriptFileUpdated', () => {
    it('body with normal data', async () => {
      processScriptStr(scriptStr
      const result = await test.update(body);
    });
  });
  */

  describe('isScriptFileUpdated', () => {
    it('with no doc', () => {
      const res = test.isScriptFileUpdated('sceneId');
      expect(res).toEqual(true);
    });
    it('with empty doc', () => {
      const res = test.isScriptFileUpdated('sceneId', {});
      expect(res).toEqual(true);
    });

    it('reqts in past', () => {
      const res = test.isScriptFileUpdated('sceneId', { reqts: Date.now() - 1000 });
      expect(res).toEqual(true);
    });

    it('reqts in future', () => {
      const res = test.isScriptFileUpdated('sceneId', { reqts: Date.now() + 1000 });
      expect(res).toEqual(false);
    });
  });

  describe('syncScripts', async () => {
    it('syncScripts - doc exists, file exists, no reqts - need update', async () => {
      const res = await test.syncScripts([{ _id: 'script1', multi: 1, devs: 'lamp,motion,lightSensor' }]);
      console.log('syncScripts = ' + util.inspect(res));
      expect(typeof res).toEqual('object');
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(1);

      expect(typeof res[0]).toEqual('object');
      expect(typeof res[0].$set).toEqual('object');
    });
    it('syncScripts - doc exists, file exists, now reqts - no update', async () => {
      const res = await test.syncScripts([{ _id: 'script1', reqts: Date.now() }]);
      // В этом случае возвращает пустую строку как элемент массива
      console.log('syncScripts = ' + util.inspect(res));
      expect(typeof res).toEqual('object');
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(1);
      expect(res[0]).toEqual('');
    });

    it('syncScripts - missing script', async () => {
      const res = await test.syncScripts([{ _id: 'script1', reqts: Date.now() }, { _id: 'script2' }]);
      /*
      [
  '',
  {
    _id: 'script2',
    '$set': { unget: 1, status: 2, err: 1, errstr: 'Script not found!' },
    '$unset': { multi: 1, devs: 1, triggers: 1, realdevs: 1, def: 1 }
  }
]*/

      // В этом случае возвращает пустую строку как элемент массива
      console.log('syncScripts = ' + util.inspect(res));
      expect(typeof res).toEqual('object');
      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(2);
      expect(res[0]).toEqual('');
      // Второго скрипта нет - запись с ошибкой будет скорректирована
      expect(typeof res[1]).toEqual('object');
      expect(typeof res[1].$set).toEqual('object');
      expect(typeof res[1].$unset).toEqual('object');

      expect(res[1].$set.unget).toEqual(1);
      expect(res[1].$unset.multi).toEqual(1); // Эти поля удаляются
    });
  });
});

function checkScript1(res) {
  expect(typeof res).toEqual('object');
  expect(res.multi).toEqual(1);

  expect(typeof res.extprops).toEqual('object');
  expect(typeof res.extprops.lamp).toEqual('object');
  expect(Array.isArray(res.extprops.lamp)).toEqual(true);
  expect(typeof res.def).toEqual('object');
  expect(typeof res.def.lamp).toEqual('object');
  expect(typeof res.devs).toEqual('string');
  // expect(typeof res.reqScript).toEqual('string');
}
