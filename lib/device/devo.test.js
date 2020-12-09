/* eslint-disable */

const util = require('util');
const EventEmitter = require('events');

const expect = require('expect'); 
const sinon = require('sinon');

const deepEqual = require('../utils/deepEqual');
const Devo = require('./devo');
const agent = require('./agent');

const typestore = require('./typestore');

const holder = new EventEmitter();
const dm = require('../datamanager');
   


const typeDocs = [
  {
    _id: 't100',
    parent: 'SensorD',
    name: 'Датчик универсальный бинарный',
    props: {
      value: { name: 'Значение', vtype: 'B', op: 'rw' },
      state: { name: 'State', vtype: 'N', op: 'calc' },
      blk: { name: 'Флаг блокировки', vtype: 'B', op: 'rw' }
    }
  },
  {
    _id: 't200',
    parent: 'SensorA',
    order: 7000,
    name: 'Датчик универсальный аналоговый',
    props: {
      value: { name: 'Значение', vtype: 'N', op: 'rw' },
      state: { name: 'State', vtype: 'N', op: 'calc' },
      setpoint: { name: 'Уставка', vtype: 'N', op: 'par' }
    }
  },
  {
    _id: 't500',
    parent: 'ActorD',
    order: 9000,
    name: 'Светильник',
    props: {
      value: { name: 'Значение', vtype: 'B', op: 'rw' },
      state: { name: 'State', vtype: 'B', op: 'calc' },
      on: { name: 'Включить', op: 'cmd' },
      off: { name: 'Выключить',  op: 'cmd' },
      toggle: { name: 'Переключить',  op: 'cmd'  }
    }
  }
];

deviceDocs = [
  {
    _id: 'd0001',
    parent: 'dg1r1',
    type: 't200',
    dn: 'DL5',
    name: 'Датчик освещенности',
    tags: ['Освещение'],
    props: {
      value: { db: 0, min: 3, max: 50, dig: 0, mu: '' },
      state: { db: 0 },
      setpoint: { db: 0, min: 0, max: 50, dig: 0, mu: '' }
    }
  },
  {
    _id: 'lamp1',
    parent: 'dg1r1',
    type: 't500',
    dn: 'LAMP1',
    name: 'Светильник',
    tags: ['Освещение'],
    props: {
      value: { },
      state: {  }
    }
  }
];

describe('device/devo', () => {
  before(() => {
 
    typestore.start(typeDocs, deviceDocs, dm);
    agent.start(holder, dm);
    sandbox = sinon.createSandbox();
    sandbox.stub(dm, 'insertToLog').returns();
  });

  after(() => {
    sandbox.restore();
  });

  describe('Create device', () => {
    it('Create device', () => {
     const dobj = new Devo(deviceDocs[0],typestore, agent );

      expect(typeof dobj).toEqual('object');
      expect(typeof dobj.typeobj).toEqual('object');
      expect(typeof dobj.typeobj.props).toEqual('object');
      expect(typeof dobj.typeobj.proparr).toEqual('object');
      // expect(dobj.typeobj.proparr.length).toEqual(3);

      expect(typeof dobj._raw).toEqual('object');
      expect(typeof dobj._aux).toEqual('object');
      expect(typeof dobj._aux.get('value')).toEqual('object');
      expect(dobj._aux.get('value').max).toEqual(50);
      expect(dobj._aux.get('value').min).toEqual(3);
      // expect(dobj._aux.get('setpoint').min).toEqual(0);
    });
    
    it('Create device, change data', () => {
      const dobj = new Devo(deviceDocs[0],typestore, agent );
      const arr = dobj.acceptData({value:16});
     
      // [ { prop: 'value', value: 16, ts: 1588334433466 } ]

      expect(typeof arr).toEqual('object');
      expect(typeof arr[0]).toEqual('object');

      expect(arr[0].value).toEqual(16);
      expect(arr[0].changed).toEqual(1);
      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj._raw.value.val).toEqual(16);
     });

     it('Create device, change data twice', () => {
      const dobj = new Devo(deviceDocs[0],typestore, agent );
      let arr = dobj.acceptData({value:16});
      // [ { prop: 'value', value: 16, ts: 1588334433466 } ]

      expect(typeof arr).toEqual('object');
      expect(typeof arr[0]).toEqual('object');
      expect(arr[0].value).toEqual(16);
      expect(arr[0].changed).toEqual(1);

      arr = dobj.acceptData({value:16});
    
      expect(typeof arr).toEqual('object');
      expect(arr[0].value).toEqual(16);
      expect(arr[0].changed).toEqual(undefined);

      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj._raw.value.val).toEqual(16);
     });

     it('Create device, change two props', () => {
      const dobj = new Devo(deviceDocs[0],typestore, agent );
      let arr = dobj.acceptData({value:16, setpoint:20});
 
      // [{ prop: 'value', value: 16, ts: 1588335477936 },
      // { prop: 'setpoint', value: 20, ts: 1588335477936 }]

      expect(typeof arr).toEqual('object');
      expect(typeof arr[0]).toEqual('object');
      

      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj.setpoint).toEqual(20); 
      expect(dobj.error).toEqual(0);
     });

     it('Create device, change twice two props', () => {
      const dobj = new Devo(deviceDocs[0],typestore, agent );
      let arr = dobj.acceptData({value:16, setpoint:20});

      arr = dobj.acceptData({value:17, setpoint:20});
      expect(arr.length).toEqual(2);

      expect(dobj.value).toEqual(17); // В свойстве
      expect(dobj.setpoint).toEqual(20); 
      expect(!dobj.error).toEqual(true);
     });

     /*
     it('Create device, change data out of range', () => {
      const dobj = new Devo(deviceDocs[0],typestore, agent );
      let arr = dobj.acceptData({value:77});
      console.log(util.inspect(arr));
      // [ {  did: 'd0001', dn: 'DL5', prop: 'value', value: 77, changed: 1,prev: 0, ts: 1595002929675},
      // {  did: 'd0001', dn: 'DL5', prop: 'error', value: 1, changed: 1,prev: 0, ts: 1595002929675},
  
      expect(typeof arr).toEqual('object');    
      expect(arr.length).toEqual(2);
      
      expect(dobj.value).toEqual(77); // В устройстве
      expect(dobj.error).toEqual(1);
     });

     it('Create device, do commands "on/off"', () => {
      const dobj = new Devo(deviceDocs[1],typestore, agent );

      // Виртуальное устройство с value, дефолтное поведение 
      dobj.on();
      expect(dobj.value).toEqual(1); 
      let res1 = dobj.off();
      expect(dobj.value).toEqual(0); 
      dobj.off();
      expect(dobj.value).toEqual(0); 
     });

     it('Create device, do commands "toggle"', () => {
      const dobj = new Devo(deviceDocs[1],typestore, agent );

      // Виртуальное устройство с value, дефолтное поведение 
      dobj.on();
      expect(dobj.value).toEqual(1); 
      dobj.toggle();
      expect(dobj.value).toEqual(0); 
      dobj.toggle();
      expect(dobj.value).toEqual(1); 
     });
     */
  });
});
