/* eslint-disable */

const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const deepEqual = require('../utils/deepEqual');
const test = require('./treemethods');

// STUBS
const descriptor = require('./descriptor');
var stub_getDescItem;
var stub_getTableDefaultRecord;

const dataformer = require('./dataformer');
var stub_getCachedTree;
var stub_getCachedSubTree;

const numerator = require('./numerator');
var stub_numerator_getNewId;

const dbstore = require('./dbstore');
var stub_dbstore_update;
var stub_dbstore_findOne;
var stub_dbstore_get;

describe('dbs/treemethods', () => {
  before(() => {
    stub_getCachedTree = sinon.stub(dataformer, 'getCachedTree');
    stub_getCachedSubTree = sinon.stub(dataformer, 'getCachedSubTree');
    stub_numerator_getNewId = sinon.stub(numerator, 'getNewId');

    stub_dbstore_update = sinon.stub(dbstore, 'update');
    stub_dbstore_update.resolves();
    stub_dbstore_findOne = sinon.stub(dbstore, 'findOne');
    stub_dbstore_get = sinon.stub(dbstore, 'get');

    stub_getDescItem = sinon.stub(descriptor, 'getDescItem');
    stub_getTableDefaultRecord = sinon.stub(descriptor, 'getTableDefaultRecord');
    stub_getDescItem.withArgs('tree', 'types').returns({
      branch: {
        table: 'typegroup',
        propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' }
      },
      leaf: { table: 'type', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } }
    });

    stub_getDescItem.withArgs('tree', 'channels').returns({
      branch: {
        table: 'devhard',
        propmap: { _id: 'id', name: 'title', title: 'title', parent: 'parent', order: 'order' }
      },
      leaf: {
        table: 'devhard',
        propmap: { _id: 'id', id: 'title', title: 'title', parent: 'parent', order: 'order' }
      }
    });

    // Таблица с папками
    stub_getDescItem.withArgs('table', 'typegroup').returns({
      store: 'db',
      collection: 'lists',
      filter: { list: 'typegroup' },
      defRootTitle: 'Типы',
      default: { name: 'NewFolder' },
      ruleID: { pref: 'tg', len: 3 }
    });

    stub_getDescItem.withArgs('table', 'devhard').returns({
      store: 'db',
      collection: 'devhard',
    });
    stub_getTableDefaultRecord.withArgs('typegroup').returns({ name: 'NewFolder' });

    // Таблица с листьями
    stub_getDescItem.withArgs('table', 'type').returns({
      store: 'db',
      collection: 'types',
      genfield: 'props',
      default: { name: 'NewType', props: { value: { name: 'Значение', vtype: 'B', op: 'r' } } },
      ruleID: { pref: 't', len: 3 }
    });
    stub_getTableDefaultRecord
      .withArgs('type')
      .returns({ name: 'NewType', props: { value: { name: 'Значение', vtype: 'B', op: 'r' } } });

    stub_getCachedSubTree.withArgs('channels', 'modbus2').returns([
      {
        id: 'd0568',
        title: 'Air_Consumption',
        order: 1000,
        component: 'channelview.modbus2'
      },
      {
        id: '9TqHEZcR6',
        title: 'New channel1',
        order: 1000,
        component: 'channelview.modbus2'
      },
      {
        id: 'd0573',
        title: 'Avr_Moment',
        order: 2000,
        component: 'channelview.modbus2'
      },
      {
        id: 'd0777',
        title: 'New channel42',
        order: 2000,
        component: 'channelview.modbus2'
      }
    ]);

    // Данные - Дерево типов
    stub_getCachedTree.withArgs('types').returns({
      title: 'Типы',
      order: 1,
      id: 'typegroup',
      children: [
        {
          title: 'Датчик дискретный',
          order: 100,
          id: 'SensorD',
          children: [
            {
              title: 'Новая папка',
              order: 74,
              id: 'tg001',
              children: []
            },
            {
              title: 'Датчик пожарный',
              order: 80,
              id: 't001'
            },
            {
              title: 'Датчик движения',
              order: 81,
              id: 't002'
            }
          ]
        },
        {
          title: 'Датчик аналоговый',
          order: 200,
          id: 'SensorA',
          children: [
            {
              title: 'Новая папка',
              order: 50,
              id: 'tg201',
              children: []
            },
            {
              title: 'Датчик температуры',
              order: 52,
              id: 't210'
            },
            {
              title: 'Датчик влажности',
              order: 81,
              id: 't230'
            }
          ]
        }
      ]
    });
  });

  after(() => {
    stub_getDescItem.restore();
    stub_getTableDefaultRecord.restore();
    stub_getCachedTree.restore();
    stub_getCachedSubTree.restore();
    stub_numerator_getNewId.restore();
    stub_dbstore_update.restore();
    stub_dbstore_findOne.restore();
    stub_dbstore_get.restore();
  });

  describe('subtree insert', () => {
    it('insert on top lebvel at the end without order - expect new order, no reorder', async () => {
      const body = {
        method: 'insert',
        type: 'subtree',
        id: 'channels',
        navnodeid: 'modbus2',

        payload: [{ parentid: 0, popupid: 'node' }]
      };

      stub_numerator_getNewId.returns('xyz1');

      const { res, reorder } = await test.insert(body);

      console.log(util.inspect(res, null, 4));
      // no order => children:[{order:1000}, {order:1000}, {order:2000}, {order:2000}] => newOrder 3000

      expect(typeof res).toEqual('object');
      expect(typeof res.devhard).toEqual('object');
      expect(typeof res.devhard.docs).toEqual('object');

      const doc = res.devhard.docs[0];
      expect(doc._id).toEqual('xyz1');
      expect(doc.order).toEqual(3000);
      expect(doc.parent).toEqual(0);

      expect(reorder).toEqual(undefined);
    });
    it('insert in gap - expect new order, reorder', async () => {
      const body = {
        method: 'insert',
        type: 'subtree',
        id: 'channels',
        navnodeid: 'modbus2',

        payload: [{ parentid: 0, popupid: 'folder', order:2000 }]
      };

      stub_numerator_getNewId.returns('xyz1');

      const { res, reorder } = await test.insert(body);

      console.log(util.inspect(res, null, 4));
      console.log('reorder '+util.inspect(reorder, null, 4));

      // no order => children:[{order:1000}, {order:1000}, {order:2000}, {order:2000}] => newOrder 3000

      expect(typeof res).toEqual('object');
      expect(typeof res.devhard).toEqual('object');
      expect(typeof res.devhard.docs).toEqual('object');

      const doc = res.devhard.docs[0];
      expect(doc._id).toEqual('xyz1');
      expect(doc.order).toEqual(3000);
      expect(doc.parent).toEqual(0);

      expect(typeof reorder).toEqual('object');

      // d0777
      expect(deepEqual(reorder, { d0777: 4000 })).toEqual(true);
    });
  });

  describe('insert', () => {
    it('insert at the end without order - expect new order, no reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorD' }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      console.log(util.inspect(res));
      // no order => children:[{order:74}, {order:80}, {order:81}] => newOrder 1081

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1081, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];
      console.log(util.inspect(res, null, 4));
      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1081);
      expect(doc.parent).toEqual('SensorD');

      expect(res.reorder).toEqual(undefined);
    });

    it('insert with order - need reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorD', order: 77 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      // order:77 => children:[{order:74}, {order:80}, {order:81}] => order:77, no reorder

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1080, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1080);
      expect(doc.parent).toEqual('SensorD');

      expect(typeof reorder).toEqual('object');
    });

    it('insert with order - no reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorD', order: 74 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      // order:77 => children:[{order:74}, {order:80}, {order:81}] => order:77, no reorder

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1080, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(77);
      expect(doc.parent).toEqual('SensorD');

      expect(reorder).toEqual(undefined);
    });

    it('insert order no gap at the end- expect new order, no reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorD', order: 81 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      // order:81 => children:[{order:74}, {order:80}, {order:81}] => order:1081

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1081, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}
      // reorder: { t002: 2080 } }

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1081);
      expect(doc.parent).toEqual('SensorD');

      expect(reorder).toEqual(undefined);
    });
    it('insert order  - in gap, no reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorA', order: 52 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      // order:67 => children:[{order:50}, {order:52}, {order:80}] => order:67

      expect(typeof res).toEqual('object');
      console.log(typeof res.type);
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(67);
      expect(doc.parent).toEqual('SensorA');
      console.log(util.inspect(reorder));
      expect(reorder).toEqual(undefined);
    });

    it('insert order no gap - expect new order, reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorA', order: 50 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const { res, reorder } = await test.insert(body);

      // order:1050 => children:[{order:50}, {order:52}, {order:80}] => order:1050

      expect(typeof res).toEqual('object');
      console.log(typeof res.type);
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1050);
      expect(doc.parent).toEqual('SensorA');
      console.log(util.inspect(reorder));
      expect(typeof reorder).toEqual('object');
      expect(deepEqual(reorder, { t210: 2050, t230: 3050 })).toEqual(true);
    });
  });

  describe('update', () => {
    it('update - move node to other folder(SensorA -> SensorD)', async () => {
      const body = {
        method: 'update',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorD', nodeid: 't210', order: 1081 }]
          }
        }
      };

      stub_dbstore_findOne
        .withArgs('types', { _id: 't210' })
        .resolves({ _id: 't210', name: 'Датчик температуры', parent: 'SensorA', order: 52 });

      stub_dbstore_findOne
        .withArgs('lists', { _id: 'SensorD' })
        .resolves({ _id: 'SensorD', parent: 'typegroup', order: 100 });

      const { res } = await test.update(body);

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t210", "order": 52, "parent": "SensorA", .. "$set":{"parent":"SensorD", "order":1081}}
      //  ]}} ]

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];

      expect(doc._id).toEqual('t210');
      expect(doc.order).toEqual(52);
      expect(doc.parent).toEqual('SensorA');

      expect(typeof doc.$set).toEqual('object');
      expect(deepEqual(doc.$set, { parent: 'SensorD', order: 1081 })).toEqual(true);
    });
  });

  describe('copy', () => {
    it('copypaste - true order, no reorder', async () => {
      const body = {
        method: 'copypaste',
        type: 'tree',
        id: 'dev',
        targetid: 'SensorD', // целевой узел, куда нужно копировать
        order: 81, // последний узел - копировать в конец
        payload: {
          types: {
            nodes: [{ nodeid: 't210' }, { nodeid: 't230' }], // отдельные листья
            seq: ['t210', 't230'] // Последовательность узлов
          }
        }
      };

      // Запрашиваются копируемые записи
      stub_dbstore_get.resolves([
        { _id: 't210', name: 'Датчик температуры', parent: 'SensorA', order: 80 },
        { _id: 't230', name: 'Датчик влажности', parent: 'SensorA', order: 81 }
      ]);

      stub_numerator_getNewId.onCall(0).returns('t004');
      stub_numerator_getNewId.onCall(1).returns('t005');
      const { res } = await test.copy(body);

      console.log(util.inspect(res, null, 4));

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t004", "order": 1081, "parent": "SensorD", "name": "Датчик температуры (copy)", props:{value:{}}},
      //    {"_id": "t005", "order": 2081, "parent": "SensorD", "name": "Датчик влажности (copy)", props:{value:{}}}
      //  ]}}
      //  ---- reorder -  нет
      //  }

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc1 = res.type.docs[0];
      expect(doc1._id).toEqual('t004');
      expect(doc1.order).toEqual(1081);
      expect(doc1.parent).toEqual('SensorD');

      const doc2 = res.type.docs[1];
      expect(doc2._id).toEqual('t005');
      expect(doc2.order).toEqual(2081);
      expect(doc2.parent).toEqual('SensorD');

      expect(res.reorder).toEqual(undefined);
    });

    it('copypaste - need reorder', async () => {
      const body = {
        method: 'copypaste',
        type: 'tree',
        id: 'dev',
        targetid: 'SensorD', // целевой узел, куда нужно копировать
        order: 80, // предпоследний узел -
        payload: {
          types: {
            nodes: [{ nodeid: 't210' }, { nodeid: 't230' }], // отдельные листья
            seq: ['t210', 't230'] // Последовательность узлов
          }
        }
      };

      // Запрашиваются копируемые записи
      stub_dbstore_get.resolves([
        { _id: 't210', name: 'Датчик температуры', parent: 'SensorA', order: 80 },
        { _id: 't230', name: 'Датчик влажности', parent: 'SensorA', order: 81 }
      ]);

      stub_numerator_getNewId.onCall(0).returns('t004');
      stub_numerator_getNewId.onCall(1).returns('t005');
      const { res, reorder } = await test.copy(body);

      console.log(util.inspect(res, null, 4));

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t004", "order": 1081, "parent": "SensorD", "name": "Датчик температуры (copy)", props:{value:{}}},
      //    {"_id": "t005", "order": 2081, "parent": "SensorD", "name": "Датчик влажности (copy)", props:{value:{}}}
      //  ]}}
      //  reorder
      //  }

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc1 = res.type.docs[0];
      expect(doc1._id).toEqual('t004');
      expect(doc1.order).toEqual(1080);
      expect(doc1.parent).toEqual('SensorD');

      const doc2 = res.type.docs[1];
      expect(doc2._id).toEqual('t005');
      expect(doc2.order).toEqual(2080);
      expect(doc2.parent).toEqual('SensorD');

      console.log(util.inspect(reorder));
      expect(typeof reorder).toEqual('object');
    });
  });
});
