/* eslint-disable */
const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const test = require('./datamanager');
const dbstore = require('./dbstore');
const deepEqual = require('../utils/deepEqual');


describe('dbs/datamanager', () => {
  describe('loadTree', () => {

   const stub = sinon.stub(dbstore, 'getData');
   stub.withArgs({table:'tgroup'}).resolves([
      { _id: 1, parent: 0, name: 'ALL' },
      { _id: 2, parent: 1, name: 'Temp' }
    ]);

    stub.withArgs({table:'type'}).resolves([
      { _id: 'TEMP_COMMON', tgroup: 2, name: 'TEMP_COMMON'},
      { _id: 'TEMP_X', tgroup: 2, name: 'TEMP_X' }
    ]);

    it('loadTree ', () => {
      console.log('loadTree start');
      return test.loadTree('typesByTgroup').then(res => {
        console.log(util.inspect(res, null, 8));

        expect(res.data.length).toEqual(1);
        // expect(res[0].title).toEqual('hello');
        // expect(deepEqual(exp, res)).toEqual(true);
      });
    });
  });
});
