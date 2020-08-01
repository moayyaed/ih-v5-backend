/* eslint-disable */

const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const test = require('./liststore');
const dm = require('../datamanager');

describe('dbs/liststore', () => {
  before(() => {
    test.start(dm);
  });
  describe('addList', () => {
    it('add first not empty list', () => {
     
      const data = [{id:'t1', label:'Type 1'}, {id:'t2', label:'Type 2'}];
      test.addList('typeList', 'type', data);

      expect(test.getListSize('typeList')).toEqual(2);
    });

    it('add second not empty list', () => {
     
      const data = [{id:'p1', label:'Place 1'}, {id:'p2', label:'Place 2'}, {id:'p3', label:'Place 3'}];

      test.addList('placeList', 'place', data);

      expect(test.getListSize('typeList')).toEqual(2);
      expect(test.getListSize('placeList')).toEqual(3);
    });
  });

  describe('getTitleFromList', () => {
    it('get place label', () => {
      test.start(dm); 
      const data = [{id:'p1', label:'Place 1'}, {id:'p2', label:'Place 2'}, {id:'p3', label:'Place 3'}];
      test.addList('placeList', 'place', data);

      const res = test.getTitleFromList('placeList', 'p2');
      expect(res).toEqual('Place 2');
    });
  });

  describe('getItemFromList', () => {
    it('get place item', () => {
      test.start(dm);
      const data = [{id:'p1', label:'Place 1'}, {id:'p2', label:'Place 2'}, {id:'p3', label:'Place 3'}];
      test.addList('placeList', 'place', data);

      const res = test.getItemFromList('placeList', 'p2');
      expect(res.label).toEqual('Place 2');
    });
  });

  describe('getListAsArray', () => {
    it('get type array', () => {
      test.start(dm);
      const data = [{id:'t1', label:'Type 1'}, {id:'t2', label:'Type 2'}];
      test.addList('typeList', 'type', data);

      const res = test.getListAsArray('typeList');
      console.log(util.inspect(res))
      expect(res.length).toEqual(2);
    });
  });
});
