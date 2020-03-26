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
const formmethods = require('./dbs/formmethods');
const cache = require('./dbs/cache');
const treemethods = require('./dbs/treemethods');
const datautil = require('./dbs/datautil');
const updateutil = require('./dbs/updateutil');

const EventEmitter = require('events');

class Datamanager extends EventEmitter {
  /**
   * Вставка одной или нескольких записей по запросу от API
   *  - добавляет в хранилище
   *  - удаляет кэши, связанные с этими данными
   *  - генерирует сообщения insert:<имя таблицы>
   *  - Вернуть :
   *      data - новые узлы дерева (поддерево)
   *      reorder - массив узлов дерева, которые нужно сдвинуть при вставке,
   *                если есть необходимость в сдвиге соседних элементов
   *
   * @param {Object} body - {type, id, payload},  формат payload зависит от body.type
   * @return {Object}  {data:[], reorder:{}}
   */
  async insert(body) {
    if (body.type == 'tree' || body.type == 'subtree') {
      const result = {};
      const { res, reorder } =
        body.method == 'copypaste' ? await treemethods.copy(body) : await treemethods.insert(body);
      if (reorder) result.reorder = reorder;

      if (res) {
        for (const table in res) {
          await this.insertDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
          const { tree, treeItems } = dataformer.formTreeAndGuideFromResDocs(res, body.id); // Формировать вставляемое поддерево
          updateutil.addToTreeguide(table, treeItems); // Добавить в treeguide
          if (tree) result.data = tree;
        }
      }
      return result;
    }
  }

  /**
   *  Добавление документов в хранилище
   *   - операция добавления
   *   - сброс кэша
   *   - генерация сообщения inserted:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - массив документов, которые нужно добавить
   */
  async insertDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);
    await dbstore.insert(desc.collection, docs);

    cache.invalidate(table);
    this.emit('inserted:' + table, { docs });
  }

  /**
   * Изменение одной или нескольких записей по запросу от API
   *  - изменяет в хранилище
   *  - удаляет кэши, связанные с этими данными
   *  - генерирует сообщения update:<имя таблицы>
   *  - Вернуть :
   *      data - изменения в дереве
   *      reorder - массив узлов дерева, которые нужно сдвинуть при перемещении узла,
   *                если есть необходимость в сдвиге соседних элементов
   *
   * @param {Object} body - {type, id, payload},  формат payload зависит от body.type
   * @return {Object}  {data:[], reorder:{}}
   */
  async update(body) {
    let treeItem;
    if (body.type == 'form') {
      const { res } = await formmethods.update(body); // res:{table:{ docs:[]}
      if (res) {
        for (const table in res) {
          await this.updateDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
          // Сформировать узел дерева - мог измениться title
          // Если на форме несколько таблиц - нужно определить основную (по breadcrumbs?)
          treeItem = dataformer.getUpdatedTreeItem(table, res[table].docs[0]);
          if (treeItem) updateutil.updateTreeguide(table, [treeItem]); // Изменить в treeguide
        }
      }
      return treeItem ? { data: [treeItem] } : ''; // Вернуть изменения для дерева (title мог измениться), порядок - нет
    }

    if (body.type == 'tree') {
      const { res, reorder } = await treemethods.update(body);
      if (res) {
        for (const table in res) {
          if (res[table].docs && res[table].docs.length) {
            await this.updateDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
            const treeItems = res[table].docs.map(doc => dataformer.getUpdatedTreeItem(table, doc));
            updateutil.updateTreeguide(table, treeItems); // Изменить в treeguide
          }
        }
      }
      return { reorder }; // Узел в дереве уже есть, он не изменился - передать только reorder
    }
  }

  /**
   *  Изменение документов в хранилище
   *   - операция изменения
   *   - сброс кэша
   *   - генерация сообщения updated:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - документы, которые нужно изменить.
   *     Каждый документ содержит $set и/или $unset атрибут c изменениями
   */
  async updateDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    const desc = descriptor.getDescItem('table', table);

    for (const doc of docs) {
      if (doc.$set || doc.$unset) {
        const setUnset = {};
        if (doc.$set) setUnset.$set = doc.$set;
        if (doc.$unset) setUnset.$unset = doc.$unset;
        await dbstore.update(desc.collection, { _id: doc._id }, setUnset);
      }
    }

    cache.invalidate(table);
    this.emit('updated:' + table, { docs });
  }

  /**
   * Удаление записей по запросу от API
   *  - удаляет в хранилище
   *  - удаляет кэши, связанные с этими данными
   *  - генерирует сообщения remove:<имя таблицы>
   *
   *  - Если какие-то записи не удалось удалить, генерируется исключение с перечислением
   *    Но при этом остальные данные удаляются
   *
   * @param {Object} body - {type, id, payload},  формат payload зависит от body.type
   * @return  - нет
   */
  async remove(body) {
    if (body.type == 'tree') {
      const { res, notRemove } = await treemethods.remove(body);

      if (res) {
        for (const table in res) {
          // Проверить, что удалить нельзя ЗДЕСЬ??
          this.removeDocs(table, res[table].docs); // Удалить из хранилища, сбросить кэши
          updateutil.deleteFromTreeguide(table, res[table].docs); // Удалить из treeguide
        }
      }

      if (notRemove && notRemove.length > 0) {
        throw { err: 'ERR', message: 'Node cannot be removed: ' + notRemove.join(',') };
      }
    }
  }

  /**
   *  Удаление документов из хранилища:
   *   - операция удаления
   *   - сброс кэша
   *   - генерация сообщения removed:
   *
   * @param {String} table - имя таблицы
   * @param {Array} docs - массив документов, которые нужно удалить, содержат текущее состояние док-та
   */
  async removeDocs(table, docs) {
    if (!table || !docs || !docs.length) return;

    // Проверить, что удалить нельзя ЗДЕСЬ??
    const desc = descriptor.getDescItem('table', table);
    const arr = docs.map(item => item.id);
    const filter = datautil.createIdsInFilter(arr);

    await dbstore.remove(desc.collection, filter, { multi: arr.length > 1 });
    cache.invalidate(table);
    this.emit('removed:' + table, { docs });
  }
}

module.exports = new Datamanager();

/*
{ "method": "insert",
  "type": "tree",
  "id": "dev",
  "payload": {
      "types": { 
       "nodes":[{"parentid":"SensorD", "order":75, "popupid":"t230"}]
    }
  }
}

{ "method": "copypaste",
  "type": "tree",
  "id": "dev",
  "nodeid":"ActorD", 
  "order":1000, 
  "payload": {
      "types": {
        "folders":[{"nodeid":"SensorD"}], 
        "nodes":[{"nodeid":"t200"},{"nodeid":"t201"},{"nodeid":"t203"}],  
        "seq":["t200", "t201", "t203", "SensorD"] 
    }
  }
}

{ "method": "update",
  "type": "tree",
  "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD", "order":42}], 
      "nodes":[{"nodeid":"t200", "parentid":"SensorA", "order":75}]  
    }
  }
}

{ "method": "remove",
  "type": "tree",
  "id": "dev",
  "payload": {
    "types": { 
      "folders":[{"nodeid":"SensorD"}],
      "nodes":[{"nodeid":"t200"}]  
    }
  }
}


*/
