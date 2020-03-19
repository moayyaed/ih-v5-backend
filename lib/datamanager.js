/**
 *  datamanager.js
 *
 *  Слой работы с данными (не историческими)
 */

// const util = require('util');

// const hut = require('./utils/hut');

const dbstore = require('./dbs/dbstore');
const descriptor = require('./dbs/descriptor');
const dataformer = require('./dbs/dataformer');
const updater = require('./dbs/updater');
const updatetree = require('./dbs/updatetree');

const EventEmitter = require('events');


class Datamanager extends EventEmitter {

  /**
   *  Получение данных по типу и имени (идентификатору):
   *    type='menu', id='pmmenu' | type='tree', id='devices'}
   *    Данные берутся из кэша или из dbstore
   *    Если в кэше нет - подгружаются в кэш
   *
   * @param {String} type - тип объекта
   * @param {String} id - идентификатор объекта
   * @return {Object}: {data, ts}
   */
  async get(type, id, nodeid) {
    const desc = descriptor.getDescItem(type, id);

    // Получение данных напрямую от nedb - эти данные не кэшируются на этом уровне
    if (desc.store == 'db') {
      this.emit('getting', 'Getting from dbstore, collection: ' + desc.collection);
      const data = await dbstore.getData(desc);
      return { data };
    }

    return dataformer.get(type, id, nodeid); // Подготовка данных и запись их в кэш
  }

  async getMeta(type, id) {
    return dataformer.getMeta(type, id);
  }

  async copypaste(body) {
    if (body.type == 'tree') {
      const { res, data, reorder } = await updatetree.copypaste(body); // возвращается включая reorder
      dataformer.updateTreeguide(body, res); // Передать изменения в словарь дерева
      dataformer.invalidateCacheForRequest(body);
      this.emit('insert:'); // Может измениться несколько таблиц, если копируются и папки и листья, например
      return { data, reorder };
    }
  }

  /**
   * Вставка одной или нескольких записей по запросу от API
   *  - добавляет в хранилище
   *  - в случае удачной операции удаляет кэши, связанные с этими данными
   *
   * @param {Object} body
   * @return {Object}
   */
  async insert(body) {
    if (body.type == 'tree') {
      const { data, reorder } = await updatetree.insert(body); // вернули массив добавлений
      dataformer.updateTreeguide(body, data); // Передаем изменения в словарь дерева
      dataformer.invalidateCacheForRequest(body); // сброс кэша дерева. Но он не сразу перегенерируется, а только когда запросят

      this.emit('insert:', body.id);
      return { data, reorder };
    }
  }

  /**
   * Изменение одной или нескольких записей по запросу от API
   *  - изменяет в хранилище
   *  - в случае удачной операции удаляет кэши, связанные с этими данными
   *
   * @param {Object} body:
   * @return {Object}
   */
  async update(body) {
    if (body.type == 'form') {
      const data = await updater.updateForm(body);
      dataformer.updateTreeguide(body, data); // Передаем изменения в словарь дерева - нужно определить деево!!
      dataformer.invalidateCacheForRequest(body);
      this.emit('form:update', body.id);
      return data ? { data } : '';
    }

    if (body.type == 'tree') {
      const { data, reorder } = await updatetree.update(body);
      dataformer.updateTreeguide(body, data); // Передаем изменения в словарь дерева
      dataformer.invalidateCacheForRequest(body);
      this.emit('tree:update', body.id);
      return { reorder }; // Узел в дереве уже есть - передать только reorder
    }
  }

  /**
   *
   */
  async remove(body) {
    if (body.type == 'tree') {
      const { removed, notRemoved } = await updatetree.remove(body);

      if (removed && removed.length) {
        dataformer.updateTreeguide(body, removed);
        dataformer.invalidateCacheForRequest(body);
      }

      if (notRemoved.length > 0) {
        throw { err: 'ERR', message: 'Folder cannot be removed: ' + notRemoved.join(',') };
      }
      this.emit('tree:remove', body.id);
    }
  }
}

module.exports = new Datamanager();

/*
/api/admin?type=components&method=getmeta

/api/admin?type=menu&id=pmmenu&method=get

/api/admin?type=tree&id=dev&method=getmeta
/api/admin?type=tree&id=dev&method=get

/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=getmeta
/api/admin?type=form&id=formDeviceCommon&nodeid=d1&method=get

/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=getmeta
/api/admin?type=form&id=formDeviceFolder&nodeid=p1&method=get

POST:

{
  "method":"get",
  "type":"tree",
  "id":"dev"
}

{
  "method": "insert",
  "type": "tree",
  "id":"dev",
  "payload":{"id":"77227799", "parent":"place", "title":"test 22", "order":10}
}

{
  "method": "update",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace"},
  "payload":{"id":"place", "title":"Все устройства"}
}
{
  "method": "update",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227788", "title":"VERY Big device", "order":150}
}

{
  "method": "insert",
  "type": "tree",
  "id":"devices",
  "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227700", "parent":"p2", "title":"New device in p2", "order":100}
}

{"method":"remove",
"type":"tree",
 "id":"devices",
 "options":{"root":"devicesByPlace", "leaf":true},
  "payload":{"id":"77227788",  "order":150}
}
*/
