/* eslint-disable */

const util = require('util');
const expect = require('expect');

const test = require('./liststore');

describe('dbs/liststore', () => {
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

  describe('getLableFromList', () => {
    it('get place label', () => {
      const data = [{id:'p1', label:'Place 1'}, {id:'p2', label:'Place 2'}, {id:'p3', label:'Place 3'}];
      test.addList('placeList', 'place', data);

      const res = test.getLableFromList('placeList', 'p2');
      expect(res).toEqual('Place 2');
    });
  });

  describe('getItemFromList', () => {
    it('get place item', () => {
      const data = [{id:'p1', label:'Place 1'}, {id:'p2', label:'Place 2'}, {id:'p3', label:'Place 3'}];
      test.addList('placeList', 'place', data);

      const res = test.getItemFromList('placeList', 'p2');
      expect(res.label).toEqual('Place 2');
    });
  });

  describe('getListAsArray', () => {
    it('get type array', () => {
      const data = [{id:'t1', label:'Type 1'}, {id:'t2', label:'Type 2'}];
      test.addList('typeList', 'type', data);

      const res = test.getListAsArray('typeList');
      console.log(util.inspect(res))
      expect(res.length).toEqual(2);
    });
  });
});
