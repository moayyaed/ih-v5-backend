/* eslint-disable */

const util = require('util');
const expect = require('expect');
// const sinon = require('sinon');

const test = require('./formmethods');
// const dbstore = require('./dbstore');
// const deepEqual = require('../utils/deepEqual');

describe('dbs/formmethods', () => {
  describe('update with empty body', () => {
    // for $set modifier: {"genprop.prop.next":xx}  - dot-notation
    it('with empty data - return rejected promise', () => {
      test.update()
      .then(res => {
        expect(res).toEqual(undefined);
      })
      .catch(err => {
        expect(typeof err).toEqual('object');
      });
    });
  });
  describe('makeSetObj', () => {
    // for $set modifier: {"genprop.prop.next":xx}  - dot-notation
    it('with empty data - return undefined', () => {
      const res = test.makeSetObj([]);

      expect(res).toEqual(undefined);
      // expect(Object.keys(res).length).toEqual(0);
    });

    it('with one row', () => {
      const res = test.makeSetObj({ value: { max: 42, min: 17 } }, 'props');
      // const res = test.makeSetObj([{ id: 'value', max: 42, min: 17 }], 'props');
      const expectProp1 = 'props.value.max';
      const expectProp2 = 'props.value.min';

      expect(typeof res).toEqual('object');
      expect(Object.keys(res).length).toEqual(2);
      expect(res[expectProp1]).toEqual(42);
      expect(res[expectProp2]).toEqual(17);
    });
  });
});
