/* eslint-disable */
const util = require('util');
const expect = require('expect');

const test = require('./treeutil');
const deepEqual = require('./deepEqual');

describe('utils/treeutil', () => {
  /*
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
*/
  describe('makeTreeWithLeaves', () => {
    const b_array = [
      { id: 'place', parent: 0, order: 0, title: 'Все' },
      { id: '77227799', parent: 'place', title: 'test 22', order: 10 },
      { id: '77227788', parent: 'place', title: 'test 88', order: 28 },
      { id: 'p1', parent: 'place', order: 100, title: 'Place 1' },
      { id: 'p2', parent: 'place', order: 200, title: 'Place 2' },
      { id: 'pxx', parent: 'xx', order: 200, title: 'Place xx' },
      { id: '77227722', parent: 'place', title: 'test' }
    ];
    
    const l_array = [
      {
        id: '77227788',
        parent: 'place',
        title: 'Big device',
        component: 'table'
      }
    ];

    it('makeTreeWithLeaves 1', () => {
      const tree = test.makeTreeWithLeaves(b_array, l_array);
  
      // expect(Array.isArray(res)).toEqual(true);
      console.log(util.inspect(tree, null, 4));
    });

  });

  describe('findSubNodeDescendants', () => {
    const tree = {
      id: 1,
      name: 'Root',
      children: [
        { id: 20, children: [{ id: 30 }] },
        // { id: 21, children: [{ id: 31 }, { id: 32 }] }
        {
          id: 21,
          children: [
            { id: 31 },
            { id: 32 },
            { id: 33, title: 'test', children: [{ id: 331 }, { id: 332 }, { id: 333 }] }
          ]
        }
      ]
    };
    it('find Descendants for subnode 33', () => {
      const subtree = test.findNodeById(tree, 33);
      console.log('SUBTREE ' + util.inspect(subtree, null, 4));
      const res = test.findAllDescendants(subtree);
      expect(Array.isArray(res)).toEqual(true);
      console.log(util.inspect(res, null, 4));
    });
  });

  describe('findAllDescendants', () => {
    const tree = {
      id: 1,
      name: 'Root',
      children: [
        { id: 20, children: [{ id: 30 }] },
        // { id: 21, children: [{ id: 31 }, { id: 32 }] }
        {
          id: 21,
          children: [
            { id: 31 },
            { id: 32 },
            { id: 33, title: 'test', children: [{ id: 331 }, { id: 332 }, { id: 333 }] }
          ]
        }
      ]
    };
    it('empty tree - empty array', () => {
      const res = test.findAllDescendants({});
      expect(Array.isArray(res)).toEqual(true);
      console.log(util.inspect(res, null, 4));
    });
    it('only root item', () => {
      const littletree = { id: 1, name: 'Root', children: [] };
      const res = test.findAllDescendants(littletree);
      console.log(util.inspect(res, null, 4));

      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(0);

      console.log(util.inspect(res, null, 4));
    });

    it('one child', () => {
      const littletree = { id: 1, name: 'Root', children: [{ id: 30 }] };
      const res = test.findAllDescendants(littletree);
      console.log(util.inspect(res, null, 4));

      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(1);
      expect(res[0].id).toEqual(30);
    });

    it('tree', () => {
      const res = test.findAllDescendants(tree);
      console.log(util.inspect(res, null, 4));

      expect(Array.isArray(res)).toEqual(true);
      expect(res.length).toEqual(9);
      expect(res[0].id).toEqual(20);
      expect(res[res.length - 1].id).toEqual(333);
    });
  });

  describe('findNodeById', () => {
    const tree = {
      id: 1,
      name: 'Root',
      children: [
        { id: 20, children: [{ id: 30 }] },
        // { id: 21, children: [{ id: 31 }, { id: 32 }] }
        {
          id: 21,
          children: [
            { id: 31 },
            { id: 32 },
            { id: 33, title: 'test', children: [{ id: 331 }, { id: 332 }, { id: 333 }] }
          ]
        }
      ]
    };
    it('empty tree', () => {
      const res = test.findNodeById({}, 42);
      expect(res).toEqual(undefined);
      console.log(util.inspect(res, null, 4));
    });

    it('node with id exists, only root item', () => {
      const ltree = { id: 1, name: 'Root', children: [] };
      const res = test.findNodeById(ltree, 1);
      expect(typeof res).toEqual('object');
    });

    it('node with id exists, its root item', () => {
      const res = test.findNodeById(tree, 1);
      expect(typeof res).toEqual('object');
      expect(res.id).toEqual(1);
    });
    it('node with id exists, its on level 2', () => {
      const res = test.findNodeById(tree, 20);
      expect(typeof res).toEqual('object');
      expect(res.id).toEqual(20);
    });

    it('node with id exists, its on level 3', () => {
      const res = test.findNodeById(tree, 30);
      expect(typeof res).toEqual('object');
      expect(res.id).toEqual(30);
    });

    it('node with id exists, its on level 3, last child', () => {
      const res = test.findNodeById(tree, 333);
      console.log('TEST 5: ' + typeof res);
      expect(typeof res).toEqual('object');
      console.log(util.inspect(res, null, 4));
      expect(res.id).toEqual(333);
    });
    it('node with id NOT exists', () => {
      const res = test.findNodeById(tree, 7333);
      console.log('TEST 5: ' + typeof res);
      expect(res).toEqual(undefined);
    });
  });
});
