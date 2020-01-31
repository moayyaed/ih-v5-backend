/* eslint-disable */
const util = require('util');
const expect = require('expect');

const test = require('./treeutil');
const deepEqual = require('./deepEqual');

describe('dbs/treeutil', () => {
  const desc = {
    branch: { table: 'level', propmap: { _id: 'id', name: 'title', parent: 'parent' } },
    leaf: { table: 'device', propmap: { _id: 'id', name: 'title', level: 'parent' }, propext: { component: 'table' } }
  };
  describe('transformForTree', () => {
    
    it('one item', () => {
      const data = [{ _id: 1, name: 'hello', parent:777 }];
      const exp  = [{ id: 1, title: 'hello', parent:777 }];
      const res = test.transformForTree(data, desc.branch);

      expect(res.length).toEqual(1);
      expect(res[0].title).toEqual('hello');
      expect(deepEqual(exp,res)).toEqual(true);
     
    });
    it('two items', () => {
      const data = [{ _id: 1, name: 'hello', parent:777 },{ _id: 2, name: 'bye', parent:0 }];
      const exp  = [{ id: 1, title: 'hello', parent:777 },{ id: 2, title: 'bye', parent:0 }];
      const res = test.transformForTree(data, desc.branch);

      expect(res.length).toEqual(2);
      expect(deepEqual(exp,res)).toEqual(true);
     
    });

    it('empty data array', () => {
      const data = [];
      const exp  = [];
      const res = test.transformForTree(data, desc.branch);

      expect(res.length).toEqual(0);
      expect(deepEqual(exp,res)).toEqual(true);
     
    });

    it('one item leaf', () => {
      const data = [];
      const exp  = [];
      const res = test.transformForTree(data, desc.leaf);

      expect(res.length).toEqual(0);
      expect(deepEqual(exp,res)).toEqual(true);
     
    });

    it('data is not array', () => {
      const data = [{ _id:'LAMP', name: 'My Lamp', level:1 }]
      const exp  = [{ id:'LAMP', title: 'My Lamp', parent:1, component: 'table' }]
      const res = test.transformForTree(data, desc.leaf);

      expect(res.length).toEqual(1);
      expect(deepEqual(exp,res)).toEqual(true);
    });
  });

  describe('buildTreeWithLeaves', () => {
    it('two arrays, one node with child', () => {
      const dataArr = [[{ _id: 1, name: 'Root', parent:0 }],[{ _id:'LAMP', name: 'My Lamp', level:1 }]];
      const res = test.buildTreeWithLeaves(desc, dataArr);
      
      expect(res.length).toEqual(1);
      console.log(util.inspect(res, null, 4))
    });
  });
});
