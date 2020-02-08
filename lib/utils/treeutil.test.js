/* eslint-disable */
const util = require('util');
const expect = require('expect');

const test = require('./treeutil');
const deepEqual = require('./deepEqual');

describe('utils/treeutil', () => {
  describe('addItemByOrder', () => {
    let arr;
    beforeEach(() => {
      arr = [
        { id: 'p1', order: 100, title: 'Place 1' }, // 0
        { id: 'p2', order: 200, title: 'Place 2' }, // 1
        { id: 'p3', order: 300, title: 'Place 3' }, // 2
        { id: 'p1000', order: 1000, title: 'Place 100' } // 3
      ];
    });

    it('add max order', () => {
      test.addItemByOrder(arr, { id: 'px', order: 2000, title: 'Place X' });

      expect(arr.length).toEqual(5);
      expect(arr[4].id).toEqual('px');
    });

    it('add middle order', () => {
      test.addItemByOrder(arr, { id: 'px', order: 500, title: 'Place X' });

      expect(arr.length).toEqual(5);
      expect(arr[3].id).toEqual('px');
    });

    it('add min order', () => {
      test.addItemByOrder(arr, { id: 'px', order: 10, title: 'Place X' });

      expect(arr.length).toEqual(5);
      expect(arr[0].id).toEqual('px');
    });
  });

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

    const tree2 = {
      id: 'place',
      order: 0,
      title: 'Все устройства',
      children: [{ id: 'p2', title: 'Place p2', order: 100, children: [] }],
      root: 'devicesByPlace'
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
      console.log('TEST 6: ' + typeof res);
      expect(res).toEqual(undefined);
    });

    it('node with tree2', () => {
      const res = test.findNodeById(tree2, 'p2');
      console.log('TEST 7: ' + typeof res);
      expect(typeof res).toEqual('object');
      expect(res.id).toEqual('p2');
    });
  });
});
