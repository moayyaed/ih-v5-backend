/* eslint-disable */

const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const dm = require('../datamanager');

// const metaUpFormData = await dm.getCachedData({ type: 'upform', id, nodeid, method: 'getmeta' }, getMetaUpForm);

const validator = require('./updateutils/validator');
// sinon.stub(validator, 'validateForm').resolves();

const descriptor = require('../descriptor');

const datamaker = require('../appspec/datamaker');

const test = require('./formmethods');

describe('formmethods - update1', () => {
  before(() => {
    sandbox = sinon.createSandbox();
    sinon.stub(validator, 'validateForm').resolves();

    sinon.stub(descriptor, 'getTableDesc').returns({
      store: 'db',
      collection: 'devhard'
    });

    sinon.stub(datamaker, 'findOrAddDoc').returns({
      _id: 123,
      chan: 'OldFolder',
      txt: ''
    });

    sandbox.stub(dm, 'getCachedData').resolves({
      data: {
        records: [
          { cell: 'p1', table: 'devhard' },
          { cell: 'p2', table: 'devhard' }
        ],
        tables: [],
        alloc: {
          devhard: { chan: 'p1', txt: 'p2' }
        }
      }
    });
  });

  after(() => {
    sandbox.restore();
  });

  describe('update form "channelfolder"', () => {
    // for $set modifier: {"genprop.prop.next":xx}  - dot-notation
    it('with empty body - return rejected promise', () => {
      const body = '';
      test
        .update(body)
        .then(res => {
          expect(res).toEqual(undefined);
        })
        .catch(err => {
          expect(typeof err).toEqual('object');
        });
    });

    it('body with normal data', async () => {
      const body = {
        method: 'update',
        type: 'form',
        id: 'channelfolder',
        nodeid: 'xxxx',
        payload: { p1: { chan: 'MyFolder' } }
      };
      const table = 'devhard';
      const result = await test.update(body);

      /** Expected:
      result = {
        res: {
          devhard: {
            docs: [ { _id: 123, chan: 'OldFolder', txt: '', '$set': { chan: 'MyFolder' } } ]
          }
        }
      }
      */
      console.log(util.inspect(result, null, 8));
      expect(typeof result).toEqual('object');
      expect(typeof result.res).toEqual('object');
      expect(typeof result.res[table]).toEqual('object');
      expect(Array.isArray(result.res.devhard.docs)).toEqual(true);
      expect(result.res.devhard.docs.length).toEqual(1);
      expect(typeof result.res.devhard.docs[0].$set).toEqual('object');
      expect(result.res.devhard.docs[0].$set.chan).toEqual('MyFolder');
    });
  });
});
