/**
 *  postapi.js
 *  Экспортирует таблицу функций, которые вызываются при post запросах на редактирование данных
 */
// const util = require('util');
const dataformer = require('./dataformer');
const treemethods = require('./treemethods');

const formmethods = require('./formmethods');
const updateutil = require('./updateutil');

/**
 * Вставка одной или нескольких записей в дерево
 *  - добавляет в хранилище
 *  - удаляет кэши, связанные с этими данными
 *  - генерирует сообщения insert:<имя таблицы>
 *  - добавляет узлы в treeguide
 *
 *  - Вернуть :
 *      data - новые узлы дерева (поддерево)
 *      reorder - массив узлов дерева, которые нужно сдвинуть при вставке,
 *                если есть необходимость в сдвиге соседних элементов
 *
 * @param {Object} body - {type, id, payload},
 * @return {Object}  {data:[], reorder:{}}
 */
async function treeInsert(body, dm) {
  const result = {};
  const { res, reorder } = body.method == 'copypaste' ? await treemethods.copy(body) : await treemethods.insert(body);

  for (const table in res) {
    await dm.insertDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
  }

  const rootTreeId = Object.keys(body.payload)[0];
  const tree = await treeAfterInsert(res, rootTreeId);
  if (reorder) result.reorder = reorder;
  if (tree) result.data = tree;
  return result;
}

async function subtreeInsert(body, dm) {
  const result = {};
  const { res, reorder } = body.method == 'copypaste' ? await treemethods.copy(body) : await treemethods.insert(body);

  for (const table in res) {
    await dm.insertDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
  }
  const tree = treeAfterInsert(res, body.id, 'subtree');
  if (reorder) result.reorder = reorder;
  if (tree) result.data = tree;
  return result;
}

async function treeAfterInsert(res, treeId, subtree) {
  if (!res) return;
  let tree;
  for (const table in res) {
    const result = dataformer.formTreeAndGuideFromResDocs(res, treeId, subtree);
    if (result.treeItem) updateutil.addToTreeguide(table, result.treeItems); // Добавить в treeguide
    if (result.tree) tree = result.tree;
  }

  return tree;
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
 * @param {Object} body - {type, id, payload}
 * @return {Object}  {data:[]}
 */
async function formUpdate(body, dm) {
  let treeItem;
  const { res } = await formmethods.update(body); // res:{table:{ docs:[]}
  if (res) {
    for (const table in res) {
      await dm.updateDocs(table, res[table].docs);
      // Сформировать узел дерева - мог измениться title
      // Если на форме несколько таблиц - нужно определить основную (по breadcrumbs?)
      treeItem = dataformer.getUpdatedTreeItem(table, res[table].docs[0]);
      if (treeItem) updateutil.updateTreeguide(table, [treeItem]); // Изменить в treeguide
    }
  }
  return treeItem ? { data: [treeItem] } : ''; // Вернуть изменения для дерева (title мог измениться), порядок - нет
}

async function treeUpdate(body, dm) {
  const { res, reorder } = await treemethods.update(body);
  if (res) {
    for (const table in res) {
      if (res[table].docs && res[table].docs.length) {
        await dm.updateDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
        const treeItems = res[table].docs.map(doc => dataformer.getUpdatedTreeItem(table, doc));
        updateutil.updateTreeguide(table, treeItems); // Изменить в treeguide
      }
    }
  }
  return { reorder }; // Узел в дереве уже есть, он не изменился - передать только reorder
}

async function subtreeUpdate(body, dm) {
  const nodeid = body.navnodeid;
  if (!nodeid) throw { message: 'Expected navnodeid!' };

  const { res, reorder } = await treemethods.update(body);
  if (res) {
    for (const table in res) {
      if (res[table].docs && res[table].docs.length) {
        await dm.updateDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
        const treeItems = res[table].docs.map(doc => dataformer.getUpdatedTreeItem(table, doc));
        updateutil.updateTreeguide(table, treeItems); // Изменить в treeguide
      }
    }
  }
  return { reorder }; // Узел в дереве уже есть, он не изменился - передать только reorder
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
 * @param {Object} body - {type, id, payload}
 * @return  - нет
 */
async function treeRemove(body, dm) {
  const { res, notRemove } = await treemethods.remove(body);
  if (res) {
    for (const table in res) {
      // Проверить, что удалить нельзя ЗДЕСЬ??
      await dm.removeDocs(table, res[table].docs); // Удалить из хранилища, сбросить кэши
      updateutil.deleteFromTreeguide(table, res[table].docs); // Удалить из treeguide
    }
  }

  if (notRemove && notRemove.length > 0) {
    throw { err: 'ERR', message: 'Node cannot be removed: ' + notRemove.join(',') };
  }
}

module.exports = {
  tree: {
    insert: treeInsert,
    copypaste: treeInsert,
    update: treeUpdate,
    remove: treeRemove
  },
  subtree: {
    insert: subtreeInsert,
    copypaste: subtreeInsert,
    update: subtreeUpdate,
    remove: treeRemove
  },
  form: {
    update: formUpdate
  }
};
