/* eslint-disable */

const util = require('util');
const EventEmitter = require('events');

const expect = require('expect');
const sinon = require('sinon');

const deepEqual = require('../utils/deepEqual');
const Devo = require('./devo');

const typestore = require('./typestore');

const holder = new EventEmitter();

const typeDocs = [
  {
    _id: 't100',
    parent: 'SensorD',
    name: 'Датчик универсальный бинарный',
    props: {
      value: { name: 'Значение', vtype: 'B', op: 'r' },
      state: { name: 'State', vtype: 'N', op: 'c' },
      blk: { name: 'Флаг блокировки', vtype: 'B', op: 'rw' }
    }
  },
  {
    _id: 't200',
    parent: 'SensorA',
    order: 7000,
    name: 'Датчик универсальный аналоговый',
    props: {
      value: { name: 'Значение', vtype: 'N', op: 'r' },
      state: { name: 'State', vtype: 'N', op: 'c' },
      setpoint: { name: 'Уставка', vtype: 'N', op: 'rw' }
    }
  },
  {
    _id: 't500',
    parent: 'ActorD',
    order: 9000,
    name: 'Светильник',
    props: {
      value: { name: 'Значение', vtype: 'N', op: 'r' },
      state: { name: 'State', vtype: 'N', op: 'c' },
      on: { name: 'Включить', command: 1 },
      off: { name: 'Выключить', command: 1 },
      toggle: { name: 'Переключить', command: 1 }
    }
  }
];

deviceDocs = [
  {
    _id: 'd0001',
    parent: 'dg1r1',
    type: 't500',
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
      state: {  },
      on: { },
      off: { }
    }
  }
];

describe('device/devo', () => {
  before(() => {
    const dm = new EventEmitter();

    typestore.start(typeDocs, deviceDocs, dm);
  });

  after(() => {});

  describe('Create device', () => {
    it('Create device', () => {
     const dobj = new Devo(deviceDocs[0],typestore );

      expect(typeof dobj).toEqual('object');
      expect(typeof dobj.typeobj).toEqual('object');
      expect(typeof dobj.typeobj.props).toEqual('object');
      expect(typeof dobj.typeobj.proparr).toEqual('object');
      expect(dobj.typeobj.proparr.length).toEqual(3);

      expect(typeof dobj._raw).toEqual('object');
      expect(typeof dobj._aux).toEqual('object');
      expect(typeof dobj._aux.get('value')).toEqual('object');
      expect(dobj._aux.get('value').max).toEqual(50);
      expect(dobj._aux.get('value').min).toEqual(3);
      expect(dobj._aux.get('setpoint').min).toEqual(0);
    });
    
    it('Create device, change data', () => {
      const dobj = new Devo(deviceDocs[0],typestore );
      const changed = dobj.change({value:16});
      console.log('XXX changed='+util.inspect(changed));
      // [ { prop: 'value', value: 16, ts: 1588334433466 } ]

      expect(typeof changed).toEqual('object');
      expect(typeof changed[0]).toEqual('object');

      expect(changed[0].value).toEqual(16); // Изменилось
      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj._raw.value.val).toEqual(16);
     });

     it('Create device, change data twice', () => {
      const dobj = new Devo(deviceDocs[0],typestore );
      let changed = dobj.change({value:16});
      // [ { prop: 'value', value: 16, ts: 1588334433466 } ]

      expect(typeof changed).toEqual('object');
      expect(typeof changed[0]).toEqual('object');

      changed = dobj.change({value:16});
      // []
      console.log(util.inspect(changed));
      expect(typeof changed).toEqual('object');
      expect(changed.length).toEqual(0);

      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj._raw.value.val).toEqual(16);
     });

     it('Create device, change two props', () => {
      const dobj = new Devo(deviceDocs[0],typestore );
      let changed = dobj.change({value:16, setpoint:20});
      console.log(util.inspect(changed));
      // [{ prop: 'value', value: 16, ts: 1588335477936 },
      // { prop: 'setpoint', value: 20, ts: 1588335477936 }]

      expect(typeof changed).toEqual('object');
      expect(typeof changed[0]).toEqual('object');
      

      expect(dobj.value).toEqual(16); // В свойстве
      expect(dobj.setpoint).toEqual(20); 
      expect(!dobj.error).toEqual(true);
     });

     it('Create device, change twice two props', () => {
      const dobj = new Devo(deviceDocs[0],typestore );
      let changed = dobj.change({value:16, setpoint:20});

    

      changed = dobj.change({value:17, setpoint:20});
      expect(changed.length).toEqual(1);

      expect(dobj.value).toEqual(17); // В свойстве
      expect(dobj.setpoint).toEqual(20); 
      expect(!dobj.error).toEqual(true);
     });

     it('Create device, change data out of range', () => {
      const dobj = new Devo(deviceDocs[0],typestore );
      let changed = dobj.change({value:77});
      console.log(util.inspect(changed));
      // [ { prop: 'value', value: 77, ts: 1588335104286 },
      // { prop: 'error', value: 'Out of range!: value', ts: 1588335104286 }]

      expect(typeof changed).toEqual('object');
      expect(changed.length).toEqual(2);
      
      expect(dobj.value).toEqual(77); // В свойстве
      expect(dobj.error.length > 0).toEqual(true);
     });

     it('Create device, do command "on"', () => {
      const dobj = new Devo(deviceDocs[1],typestore, holder );
      let res = dobj.on();
      console.log('do command res on:'+res);
      let res1 = dobj.off();
      console.log('do command res off:'+res1);
      dobj.off();
      console.log('do command off AGAIN:'+res1);
     });
  });
});
