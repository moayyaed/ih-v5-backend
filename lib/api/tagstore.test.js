/* eslint-disable */

const util = require('util');
const expect = require('expect');

const test = require('./tagstore');


describe('dbs/tagstore', () => {
  describe('add', () => {
    it('add two  words, then clear', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.clear();
      expect(test.getSize()).toEqual(0);
    });

    it('add two words, then delete one by one', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.delete(['Climate'], 'd1');
      expect(test.getSize()).toEqual(1);
      test.delete(['Light'], 'd1');
      expect(test.getSize()).toEqual(0);
    });
  });

  describe('update&delete', () => {

    it('update without updating', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update(['Light', 'Climate'],['Light', 'Climate'], 'd1', 'devices');
      expect(test.getSize()).toEqual(2);
      test.clear();
    });

    it('update without updating - other device', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update(['Light', 'Climate'],['Light', 'Climate'], 'd2', 'devices');
      expect(test.getSize()).toEqual(2);
      test.clear();
    });

    it('add, update then delete', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update([],['Light', 'Climate'], 'd2', 'devices');
      expect(test.getSize()).toEqual(2);

      test.delete(['Light'], 'd1');
      expect(test.getSize()).toEqual(2);
      test.delete(['Light'], 'd2');
      expect(test.getSize()).toEqual(1);
      test.clear();
    });

    it('update2', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update([], ['Light2', 'Climate2'], 'd2', 'devices');
      expect(test.getSize()).toEqual(4);

      test.update(['Light2', 'Climate2'],['Light', 'Climate'], 'd2', 'devices');
      expect(test.getSize()).toEqual(2);
      test.clear();
    });

    it('update with empty newtags', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update([], ['Light2', 'Climate2'], 'd2', 'devices');
      expect(test.getSize()).toEqual(4);

      test.update(['Light', 'Climate'],[],  'd1', 'devices');
      expect(test.getSize()).toEqual(2);
      test.clear();
    });

    it('update with the save tag', () => {
      test.start();
      test.add(['Light', 'Climate'], 'd1', 'devices');

      expect(test.getSize()).toEqual(2);
      test.update(['Light', 'Climate'], ['Light', 'Climate2'], 'd1', 'devices');
      expect(test.getSize()).toEqual(2);

      test.clear();
    });
  });

  
});

