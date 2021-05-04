/**
 *  postapi.js
 *  Экспортирует таблицу функций, которые вызываются при post запросах на редактирование данных
 */
const util = require('util');

const dataformer = require('./dataformer');
const treemethods = require('./treemethods');
const formmethods = require('./formmethods');
const updatetg = require('./updateutils/updatetreeguide');
const syscmd = require('./syscommand');
const apicmd = require('./apicommand');

/**
 * Обработка POST запросов - команды от узлов дерева (method:'send')
 *
 *  method:'send',
 *  nodeid: узел-отправитель
 *  payload: {emit:'start:plugin'}
 * Отправляются команды в payload
 *
 * @param {*} body
 * @param {*} holder
 */
async function commandFromTree(body, holder) {
  const { nodeid, payload } = body;
  if (payload && payload.emit) {
    holder.emit(payload.emit, nodeid);
    return;
  }

  throw { message: 'Unexpected payload: ' + util.inspect(body.payload) + ' from node: ' + body.nodeid };
}

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
// async function treeInsert(body, holder) {
async function treeInsert(body, holder) {
  const dm = holder.dm;
  const result = {};
  try {
    const { res, reorder } =
      body.method == 'copypaste' ? await treemethods.copy(body, dm) : await treemethods.insert(body, dm);

    for (const table in res) {
      await dm.insertDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
    }

    const rootTreeId = Object.keys(body.payload)[0];
    // {res, treeId, subtree, navnodeid}
    const tree = await treeAfterInsert({ res, treeId: rootTreeId }, holder);
    if (reorder) result.reorder = reorder;
    if (tree) result.data = tree;
    return result;
  } catch (e) {
    throw e;
  }
}

// async function subtreeInsert(body, holder) {
async function subtreeInsert(body, holder) {
  const dm = holder.dm;
  const result = {};
  let resobj;

  if (body.method == 'copypaste' || body.method == 'clone') {
    resobj = await treemethods.copy(body, dm);
  } else {
    resobj = await treemethods.insert(body, dm);
  }
  const { res, reorder } = resobj;

  for (const table in res) {
    await dm.insertDocs(table, res[table].docs); // Записать в хранилище, сбросить кэш
    dm.invalidateCache({ type: 'subtree', id: body.id, nodeid: body.navnodeid });
  }
  const tree = await treeAfterInsert({ res, treeId: body.id, subtree: 1, navnodeid: body.navnodeid }, holder);
  if (reorder) result.reorder = reorder;
  if (tree) result.data = tree;
  return result;
}

async function treeAfterInsert({ res, treeId, subtree, navnodeid }, holder) {
  const dm = holder.dm;
  if (!res) return;
  let tree;
  for (const table in res) {
    const result = dataformer.formTreeAndGuideFromResDocs(res, treeId, subtree, navnodeid, dm);
    if (result.treeItem) updatetg.addToTreeguide(table, result.treeItems); // Добавить в treeguide
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
async function formUpdate(body, holder) {
  const dm = holder.dm;
  let treeItem;
  // При изменении формы могут быть операции добавления/удаления строк связанных таблиц
  const { res, insert, remove } = await formmethods.update(body, holder); // res:{table:{ docs:[]}}, insert:{table:{ docs:[]}}, remove:{table:{ docs:[]}}

  //  Добавление и удаление строк связанных таблиц
  if (remove) {
    for (const table in remove) {
      await dm.removeDocs(table, remove[table].docs, dm.datamaker.beforeRemove);
    }
  }

  if (insert) {
    for (const table in insert) {
      await dm.insertDocs(table, insert[table].docs);
    }
  }
  if (res) {
    for (const table in res) {
      await dm.updateDocs(table, res[table].docs, dm.datamaker.beforeUpdate);
      // Сформировать узел дерева - мог измениться title
      // Если на форме несколько таблиц - нужно определить основную (по breadcrumbs?)
      if (res[table].docs && res[table].docs.length) {
        treeItem = dataformer.getUpdatedTreeItem(table, res[table].docs[0], dm);
        if (treeItem) updatetg.updateTreeguide(table, [treeItem]); // Изменить в treeguide
      }
    }
  }
  return treeItem ? { data: [treeItem] } : ''; // Вернуть изменения для дерева (title мог измениться), порядок - нет
}

// async function treeUpdate(body, holder) {
async function treeUpdate(body, holder) {
  const dm = holder.dm;
  const { res, reorder } = await treemethods.update(body, dm);
  if (res) {
    for (const table in res) {
      if (res[table].docs && res[table].docs.length) {
        await dm.updateDocs(table, res[table].docs, dm.datamaker.beforeUpdate); // Записать в хранилище, сбросить кэш
        const treeItems = res[table].docs.map(doc => dataformer.getUpdatedTreeItem(table, doc, dm));
        updatetg.updateTreeguide(table, treeItems); // Изменить в treeguide
      }
    }
  }
  return { reorder }; // Узел в дереве уже есть, он не изменился - передать только reorder
}

// async function subtreeUpdate(body, holder) {
async function subtreeUpdate(body, holder) {
  const dm = holder.dm;
  const nodeid = body.navnodeid;
  if (!nodeid) throw { message: 'Expected navnodeid!' };

  const { res, reorder } = await treemethods.update(body, dm);
  if (res) {
    for (const table in res) {
      if (res[table].docs && res[table].docs.length) {
        await dm.updateDocs(table, res[table].docs, dm.datamaker.beforeUpdate);
        dm.invalidateCache({ type: 'subtree', id: body.id, nodeid: body.navnodeid });

        const treeItems = res[table].docs.map(doc => dataformer.getUpdatedTreeItem(table, doc, dm));
        updatetg.updateTreeguide(table, treeItems); // Изменить в treeguide
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
async function treeRemove(body, holder) {
  const dm = holder.dm;
  const { res, notRemove } = await treemethods.remove(body, dm);
  if (res) {
    for (const table in res) {
      // beforeRemove - Проверить, что удалить нельзя в dm - будет throw
      await dm.removeDocs(table, res[table].docs, dm.datamaker.beforeRemove); // Удалить из хранилища, сбросить кэши
      updatetg.deleteFromTreeguide(table, res[table].docs); // Удалить из treeguide

      if (body.type == 'subtree') {
        dm.invalidateCache({ type: 'subtree', id: body.id, nodeid: body.navnodeid });
      }
    }
  }

  if (notRemove && notRemove.length > 0) {
    throw { err: 'ERR', message: 'Node cannot be removed: ' + notRemove.join(',') };
  }
}

async function getCommandFromButton(body, holder) {
  if (!body || !body.command) throw { err: 'ERR', message: 'Missing command!' };
  // if (!body.nodeid) throw { err: 'ERR', message: 'Missing nodeid!' };

  const res = await syscmd.exec(body, holder);
  return res || {};
}

async function getRowCommandFromButton(body, holder) {
  if (!body || !body.command) throw { err: 'ERR', message: 'Missing command!' };
  // if (!body.nodeid) throw { err: 'ERR', message: 'Missing nodeid!' };
  let res;

  if (body.command.startsWith('api')) {
    res = await apicmd.exec(body, holder);
  } else {
    res = await syscmd.exec(body, holder);
  }
  return res || {};
}

async function subtreeDialog(body, holder) {
  // const dm = holder.dm;
  if (!body.payload) throw { message: 'Missing body.payload!' };
  if (!body.payload.action) throw { message: 'Missing body.payload.action!' };

  // Дальше уровень domain
  return holder.dm.datamaker.subtreeAction(body, holder);
  // return body.payload.action == 'clone' ? holder.dm.datamaker. : holder.dm.datamaker.subtreeAction(body, holder);
  /*
  // Устройство - did
  switch (body.payload.action) {
    case 'grouplink' :
    default: throw {  message: 'Unexpected action: '+ body.payload.action};
  }
  */
}

module.exports = {
  tree: {
    insert: treeInsert,
    copypaste: treeInsert,
    update: treeUpdate,
    remove: treeRemove,
    send: commandFromTree
  },
  subtree: {
    insert: subtreeInsert,
    copypaste: subtreeInsert,
    update: subtreeUpdate,
    remove: treeRemove,
    clone: subtreeInsert,
    dialog: subtreeDialog
  },
  form: {
    update: formUpdate,
    command: getCommandFromButton,
    row_command: getRowCommandFromButton
  }
};

/*
{
"type":"subtree",  
"id": "channels",
"method": "dialog",
"navnodeid": "modbus1",
"payload":{"folders":[{"nodeid": "wpn7ur8w7"}]}
 
}
*/
