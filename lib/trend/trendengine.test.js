/* eslint-disable */

const util = require('util');
const EventEmitter = require('events');

const expect = require('expect');
const sinon = require('sinon');

const deepEqual = require('../utils/deepEqual');

const Trendengine = require('./trendengine');

const dbconnector = require('../dbconnector');

const holder = new EventEmitter();
// const dm = require('../datamanager');

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
      const data = [{ did: 'd001', dn: 'DEV1', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV1');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751123102);
      expect(toWrite[0].val).toEqual(2);
    });

    it('Change data DEV2 -> no toWrite', () => {
      const data = [{ did: 'd002', dn: 'DEV2', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(0);
    });

    it('Change data DEV3 -> toWrite=1', () => {
      const data = [{ did: 'd003', dn: 'DEV3', prop: 'value', ts: 1604751123102, value: 2, changed: 1, prev: 3 }];
      const toWrite = engine.onChangeDeviceData(data);

      expect(typeof toWrite).toEqual('object');
      expect(toWrite.length).toEqual(1);
      expect(toWrite[0].dn).toEqual('DEV3');
      expect(toWrite[0].prop).toEqual('value');
      expect(toWrite[0].ts).toEqual(1604751123102);
      expect(toWrite[0].val).toEqual(2);
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

  describe('Calc on change', () => {
    it('Create trendSet items with dbmet=3 - period + calc_type', () => {
      expect(typeof engine.trendSet).toEqual('object');

      engine.addItem({ did: 'd0011', prop: 'value', dn: 'DEV11', dbmet: 3,  });
      expect(typeof engine.trendSet['d001_value']).toEqual('object');

      engine.addItem({ did: 'd0012', prop: 'value', dn: 'DEV12', dbmet: 3 });
      expect(typeof engine.trendSet['d002_value']).toEqual('object');

      engine.addItem({ did: 'd0013', prop: 'value', dn: 'DEV13', dbmet: 3, dbdelta: 3 });
      expect(typeof engine.trendSet['d003_value']).toEqual('object');
    });
  });
});
