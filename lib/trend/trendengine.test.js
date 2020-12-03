/* eslint-disable */

const util = require('util');
const EventEmitter = require('events');

const expect = require('expect');
const sinon = require('sinon');

// const deepEqual = require('../utils/deepEqual');

const Trendengine = require('./trendengine');
const dbconnector = require('../dbconnector');

const holder = new EventEmitter();
holder.devSet = {};

let engine;

describe('trend/trendengine', () => {
  before(() => {
    engine = new Trendengine(holder);
    sandbox = sinon.createSandbox();
    sandbox.stub(dbconnector, 'write').returns();
  });

  after(() => {
    sandbox.restore();
  });

  describe('Save on change', () => {
    it('Create trendSet items', () => {
      expect(typeof engine.trendSet).toEqual('object');

      engine.addItem({ did: 'd001', prop: 'value', dn: 'DEV1', dbmet: 1 });
      expect(typeof engine.trendSet['d001_value']).toEqual('object');

      engine.addItem({ did: 'd002', prop: 'value', dn: 'DEV2', dbmet: 2 });
      expect(typeof engine.trendSet['d002_value']).toEqual('object');

      engine.addItem({ did: 'd003', prop: 'value', dn: 'DEV3', dbmet: 1, dbdelta: 3 });
      expect(typeof engine.trendSet['d003_value']).toEqual('object');
    });

    it('Change data DEV1 -> toWrite=1', () => {
      const data = [{ did: 'd001', dn: 'DEV1', prop: 'value', ts: 1604751123102, value: 1, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV1');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751123102);
      expect(toWrite[0].val).toEqual(1);
    });

    it('Change data DEV2 -> no toWrite', () => {
      const data = [{ did: 'd002', dn: 'DEV2', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(0);
    });

    it('Change data DEV1, DEV3 -> toWrite=2', () => {
      const data = [
        { did: 'd001', dn: 'DEV1', prop: 'value', ts: 1604751123105, value: 2, changed: 1, prev: 3 },
        { did: 'd003', dn: 'DEV3', prop: 'value', ts: 1604751123105, value: 2, changed: 1, prev: 3 }
      ];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(2);
      expect(toWrite[0].dn).toEqual('DEV1');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].val).toEqual(2);

      expect(toWrite[1].dn).toEqual('DEV3');
      expect(toWrite[1].prop).toEqual('value');
      expect(toWrite[1].val).toEqual(2);
    });

    it('Change data DEV3 again(+1) -> dbdelta=3, no toWrite', () => {
      // dbdelta=3
      const data = [{ did: 'd003', dn: 'DEV3', prop: 'value', ts: 1604751123102, value: 2 + 1, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);
 
      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(0);
    });

    it('Change data DEV3 again(+3) -> dbdelta=3,  toWrite=1', () => {
      // dbdelta=3
      const data = [{ did: 'd003', dn: 'DEV3', prop: 'value', ts: 1604751123102, value: 2 + 3, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(1);
    });

    it('Change data DEV1 again  -> no delta, toWrite=1', () => {
      const data = [{ did: 'd001', dn: 'DEV1', prop: 'value', ts: 1604751129000, value: 2 + 1, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV1');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751129000);
      expect(toWrite[0].val).toEqual(3);
    });
  });

  describe('Calc on change - min', () => {
    it('Create trendSet item with dbmet=3, dbcalc_type=min', () => {
      expect(typeof engine.trendSet).toEqual('object');

      engine.addItem({ did: 'd0011', prop: 'value', dn: 'DEV11', dbmet: 3, dbcalc_type:'min' });
      expect(typeof engine.trendSet['d0011_value']).toEqual('object');
    });

    it('Change DEV11.value=1  -> calc min, toWrite=0, check calcStore.min', () => {
      const data = [{ did: 'd0011', dn: 'DEV11', prop: 'value', ts: 1604751130000, value: 1 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(0);
      const trenditem = engine.trendSet['d0011_value'];
    
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.ts).toEqual(1604751130000);
      expect(trenditem.calcStore.min.val).toEqual(1);
    });

    it('Change DEV11.value=-1  -> calc min, toWrite=0, check calcStore.min', () => {
      const data = [{ did: 'd0011', dn: 'DEV11', prop: 'value', ts: 1604751140000, value: -1 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0011_value'];
      expect(typeof trenditem.calcStore.min).toEqual('object');

      expect(trenditem.calcStore.min.ts).toEqual(1604751140000);
      expect(trenditem.calcStore.min.val).toEqual(-1);
    });

    it('Change DEV11.value=5  -> calc min, toWrite=0, check calcStore.min', () => {
      const data = [{ did: 'd0011', dn: 'DEV11', prop: 'value', ts: 1604751140000, value: 5 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0011_value'];
    
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.ts).toEqual(1604751140000);
      expect(trenditem.calcStore.min.val).toEqual(-1);
    });

    it('getByCalcType reset=0 -> toWrite=1', () => {
      const trenditem = engine.trendSet['d0011_value'];
      const toWrite = trenditem.getByCalcType(false);

      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV11');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751140000);
      expect(toWrite[0].val).toEqual(-1);
    
      // reset=0 - не сбросились
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.ts).toEqual(1604751140000);
      expect(trenditem.calcStore.min.val).toEqual(-1);
    });

    it('getByCalcType reset=1 -> toWrite=1', () => {
      const trenditem = engine.trendSet['d0011_value'];
      const toWrite = trenditem.getByCalcType(true);

      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV11');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751140000);
      expect(toWrite[0].val).toEqual(-1);
    
      // reset=1 - должно  сброситься
      expect(trenditem.calcStore.min.ts).toEqual(0);
    });

    it('getByCalcType after reset -> toWrite=0', () => {
      const trenditem = engine.trendSet['d0011_value'];
      const toWrite = trenditem.getByCalcType(false);
      expect(toWrite.length).toEqual(0);
    });
    
  });

  describe('Calc on change - minmax', () => {
    it('Create trendSet item with dbmet=3, dbcalc_type=minmax', () => {
      engine.addItem({ did: 'd0012', prop: 'value', dn: 'DEV12', dbmet: 3, dbcalc_type:'minmax' });
      expect(typeof engine.trendSet['d0012_value']).toEqual('object');

    });

    it('Change DEV12.value=1  -> check calcStore.minmax', () => {
      const data = [{ did: 'd0012', dn: 'DEV12', prop: 'value', ts: 1604751140000, value: 1 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0012_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.ts).toEqual(1604751140000);
      expect(trenditem.calcStore.min.val).toEqual(1);

      expect(typeof trenditem.calcStore.max).toEqual('object');
      expect(trenditem.calcStore.max.ts).toEqual(1604751140000);
      expect(trenditem.calcStore.max.val).toEqual(1);
    });

    it('getByCalcType reset=0 -> toWrite=1, min=max', () => {
      const trenditem = engine.trendSet['d0012_value'];
      const toWrite = trenditem.getByCalcType(false);

      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV12');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].val).toEqual(1);
    });


    it('Change DEV12.value=5  -> calc min, toWrite=0, check calcStore.min', () => {
      const data = [{ did: 'd0012', dn: 'DEV12', prop: 'value', ts: 1604751150000, value: 5 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0012_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.val).toEqual(1);
      expect(trenditem.calcStore.max.val).toEqual(5);
    });

    it('Change DEV12.value=-5  -> calc min, toWrite=0, check calcStore.min', () => {
      const data = [{ did: 'd0012', dn: 'DEV12', prop: 'value', ts: 1604751250000, value: -5 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0012_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.min).toEqual('object');
      expect(trenditem.calcStore.min.val).toEqual(-5);
      expect(trenditem.calcStore.max.val).toEqual(5);
    });

    it('getByCalcType reset=1 -> toWrite=2', () => {
      const trenditem = engine.trendSet['d0012_value'];
      const toWrite = trenditem.getByCalcType(true);

      expect(toWrite.length).toEqual(2);
      expect(toWrite[0].dn).toEqual('DEV12');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].val).toEqual(5);
      expect(toWrite[1].dn).toEqual('DEV12');
      expect(toWrite[1].prop).toEqual('value');
      expect(toWrite[1].val).toEqual(-5);
    
      // reset=1 - должно  сброситься
      expect(trenditem.calcStore.min.ts).toEqual(0);
      expect(trenditem.calcStore.max.ts).toEqual(0);
    });

    it('getByCalcType after reset -> toWrite=0', () => {
      const trenditem = engine.trendSet['d0012_value'];
      const toWrite = trenditem.getByCalcType(false);
      expect(toWrite.length).toEqual(0);
    });
  });

  describe('Calc on change - first', () => {
    it('Create trendSet item with dbmet=3, dbcalc_type=first', () => {
      engine.addItem({ did: 'd0013', prop: 'value', dn: 'DEV13', dbmet: 3, dbcalc_type:'first' });
      expect(typeof engine.trendSet['d0013_value']).toEqual('object');
    });

    it('Change DEV13.value=100  -> calc first, toWrite=0, check calcStore.first', () => {
      const data = [{ did: 'd0013', dn: 'DEV13', prop: 'value', ts: 1604751150000, value: 100 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0013_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.first).toEqual('object');
      expect(trenditem.calcStore.first.val).toEqual(100);
    });
    it('Change DEV13.value=199  -> calc first, toWrite=0, check calcStore.first', () => {
      const data = [{ did: 'd0013', dn: 'DEV13', prop: 'value', ts: 1604751150000, value: 199 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0013_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.first).toEqual('object');
      expect(trenditem.calcStore.first.val).toEqual(100);
    });
  });

  describe('Calc on change - last', () => {
    it('Create trendSet item with dbmet=3, dbcalc_type=last', () => {
      engine.addItem({ did: 'd0014', prop: 'value', dn: 'DEV14', dbmet: 3, dbcalc_type:'last' });
      expect(typeof engine.trendSet['d0014_value']).toEqual('object');
    });

    it('Change DEV14.value=100  -> calc first, toWrite=0, check calcStore.last', () => {
      const data = [{ did: 'd0014', dn: 'DEV14', prop: 'value', ts: 1604751150000, value: 100 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0014_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.last).toEqual('object');
      expect(trenditem.calcStore.last.val).toEqual(100);
    });
    it('Change DEV14.value=199  -> calc first, toWrite=0, check calcStore.last', () => {
      const data = [{ did: 'd0014', dn: 'DEV14', prop: 'value', ts: 1604751150000, value: 199 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0014_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.last).toEqual('object');
      expect(trenditem.calcStore.last.val).toEqual(199);
    });
  });

  describe('Calc on change - mean', () => {
    it('Create trendSet item with dbmet=3, dbcalc_type=mean', () => {
      engine.addItem({ did: 'd0015', prop: 'value', dn: 'DEV15', dbmet: 3, dbcalc_type:'mean' });
      expect(typeof engine.trendSet['d0015_value']).toEqual('object');
    });

    it('Change DEV15.value=1  -> toWrite=0, check calcStore.mean.arr', () => {
      const data = [{ did: 'd0015', dn: 'DEV15', prop: 'value', ts: 1604751150000, value: 1 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0015_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.mean).toEqual('object');
      expect(trenditem.calcStore.mean.arr.length).toEqual(1);
    });

    it('Change DEV15, add [3,5,7]  -> calc first, toWrite=0, check calcStore.last', () => {
      const data = [
        { did: 'd0015', dn: 'DEV15', prop: 'value', ts: 1604751150001, value: 3 },
        { did: 'd0015', dn: 'DEV15', prop: 'value', ts: 1604751150002, value: 5 },
        { did: 'd0015', dn: 'DEV15', prop: 'value', ts: 1604751150003, value: 7 }
      ];
      const toWrite = engine.onChangeDeviceData(data);

      expect(toWrite.length).toEqual(0);
     
      const trenditem = engine.trendSet['d0015_value'];
      expect(typeof trenditem).toEqual('object');
      expect(typeof trenditem.calcStore).toEqual('object');
      expect(typeof trenditem.calcStore.mean).toEqual('object');
      expect(trenditem.calcStore.mean.arr.length).toEqual(4);
    });

    it('getByCalcType reset=1 -> toWrite=1', () => {
      const trenditem = engine.trendSet['d0015_value'];
      const toWrite = trenditem.getByCalcType(true);

      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV15');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].val).toEqual(4);
      expect(toWrite[0].ts).toEqual(1604751150003);

      // reset=1 - должно  сброситься
      expect(trenditem.calcStore.mean.ts).toEqual(0);
      
    });

    it('getByCalcType after reset -> toWrite=0', () => {
      const trenditem = engine.trendSet['d0015_value'];
      const toWrite = trenditem.getByCalcType(false);
      expect(toWrite.length).toEqual(0);
    });
  });
});
