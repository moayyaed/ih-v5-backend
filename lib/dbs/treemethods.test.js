/* eslint-disable */

const util = require('util');
const expect = require('expect');
const sinon = require('sinon');

const deepEqual = require('../utils/deepEqual');

const test = require('./treemethods');

// STUBS
const descriptor = require('./descriptor');
const stub_getDescItem = sinon.stub(descriptor, 'getDescItem');
const stub_getTableDefaultRecord = sinon.stub(descriptor, 'getTableDefaultRecord');

const dataformer = require('./dataformer');
const stub_getCachedTree = sinon.stub(dataformer, 'getCachedTree');

const numerator = require('./numerator');
const stub_numerator_getNewId = sinon.stub(numerator, 'getNewId');

const dbstore = require('./dbstore');
const stub_dbstore_update = sinon.stub(dbstore, 'update');
stub_dbstore_update.resolves();

const stub_dbstore_findOne = sinon.stub(dbstore, 'findOne');

const stub_dbstore_get = sinon.stub(dbstore, 'get');

// Метаданные
// tree, types
stub_getDescItem.withArgs('tree', 'types').returns({
  branch: {
    table: 'typegroup',
    propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' }
  },
  leaf: { table: 'type', propmap: { _id: 'id', name: 'title', parent: 'parent', order: 'order' } }
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

describe('dbs/treemethods', () => {
  before(() => {
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

      const {res, reorder} = await test.insert(body);

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
      expect(doc.parent).toEqual("SensorD");

      expect(res.reorder).toEqual(undefined);
    });

    it('insert with order - expect the same order, no reorder', async () => {
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

      const {res, reorder} = await test.insert(body);

       // order:77 => children:[{order:74}, {order:80}, {order:81}] => order:77, no reorder

     // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 77, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];
     
      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(77);
      expect(doc.parent).toEqual("SensorD");

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

      const {res, reorder} =  await test.insert(body);

      
       // order:81 => children:[{order:74}, {order:80}, {order:81}] => order:1080 

     // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1080, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}
      // reorder: { t002: 2080 } }

      expect(typeof res).toEqual('object');
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];
     
      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1080);
      expect(doc.parent).toEqual("SensorD");

      expect(typeof reorder).toEqual('object');
      expect(deepEqual(reorder, { t002: 2080 })).toEqual(true);
    });
    it('insert order no gap - expect new order, reorder', async () => {
      const body = {
        method: 'insert',
        type: 'tree',
        id: 'dev',
        payload: {
          types: {
            nodes: [{ parentid: 'SensorA', order: 51 }]
          }
        }
      };

      stub_numerator_getNewId.returns('t003');

      const {res, reorder} = await test.insert(body);

       // order:51 => children:[{order:50}, {order:52}, {order:80}] => order:1050 

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t003", "order": 1050, "parent": "SensorD", "name": "NewType", props:{value:{}}}
      //  ]}}
      // reorder: { t210: 2050, t230: 3050 } }
    
      expect(typeof res).toEqual('object');
      console.log(typeof res.type);
      expect(typeof res.type).toEqual('object');
      expect(typeof res.type.docs).toEqual('object');

      const doc = res.type.docs[0];
     
      expect(doc._id).toEqual('t003');
      expect(doc.order).toEqual(1050);
      expect(doc.parent).toEqual("SensorA");
      console.log(util.inspect(reorder))
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
            nodes: [{ parentid:'SensorD', nodeid: 't210', order:1081 }], 
          
          }
        }
      };

      stub_dbstore_findOne.withArgs('types', { _id:'t210' }).resolves(
        { _id: 't210', name: 'Датчик температуры', parent: 'SensorA', order:52 }
      ); 

      stub_dbstore_findOne.withArgs('lists', { _id:'SensorD' }).resolves(
        { _id: 'SensorD', parent: 'typegroup', order:100 }
      ); 
      
      const {res} = await test.update(body);

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
      expect(doc.parent).toEqual("SensorA");

      expect(typeof doc.$set).toEqual('object');
      expect(deepEqual(doc.$set, {"parent":"SensorD", "order":1081})).toEqual(true);
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
        { _id: 't210', name: 'Датчик температуры', parent: 'SensorA', order:80 },
        { _id: 't230', name: 'Датчик влажности', parent: 'SensorA', order:81 }
        ]); 

      stub_numerator_getNewId.onCall(0).returns('t004');
      stub_numerator_getNewId.onCall(1).returns('t005');
      const {res} = await test.copy(body);

      console.log(util.inspect(res, null, 4));

      // Expect res:
      //  {"type":{docs: [
      //    {"_id": "t004", "order": 1081, "parent": "SensorD", "name": "Датчик температуры (copy)", props:{value:{}}},
      //    {"_id": "t005", "order": 2081, "parent": "SensorD", "name": "Датчик влажности (copy)", props:{value:{}}}
      //  ]}}
      //  ---- reorder -  нет
      //  }
     
      
      expect(typeof res).toEqual('object');
     
      expect(res.reorder).toEqual(undefined);

    });
  });
});
