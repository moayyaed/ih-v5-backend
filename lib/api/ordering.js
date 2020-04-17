/**
 *  ordering.js
 */

const util = require('util');

const treeutil = require('../utils/treeutil');
const dm = require('../datamanager');

const descriptor = require('../descriptor');

/**
 * Вычисление order для вставляемых в дерево узлов
 *  - возвращает значения для расчета вставляемых узлов
 *  - при необходимости сдвига существующих узлов выполняет сдвиг (пишет в таблицу)
 *
 * @param {Object}: {payloadItem, treeObj, treeDesc, parentid, previd, seq}
 *         payloadItem {Array | Object} - входные элементы дерева, для которых вычисляется order
 *         treeObj {Object}  - дерево, в которое вставляются узлы
 *         treeDesc {Object} - дескриптор дерева treeObj (для определения имен таблиц)
 *         parentid {String} - id узла, в который вставляют
 *         previd {Number} - id соседнего узла, за которым будет вставка (0 - в конец)
 *         qItems {Number} - число узлов для вставки
 *
 * @return {Object}: { startOrder, delta, shifted }
 *          startOrder {Number} - значение order узла, ПОСЛЕ которого будет вставка
 *          delta {Number} - приращение при нумерации вставляемых узлов
 *               Если вставка в пустой массив, то startOrder=0, delta=1000 => order=0+1000
 *         shifted {Object} - сдвинутые узлы
 */
async function exec({ payloadItem, treeObj, treeDesc, parentid, previd, seq }) {
  const qItems = getQItems(payloadItem);
  if (!qItems) return {};

  // Поддерево, куда вставляем - это parent. Если 0 - вставка на верхний уровень
  let targetObj;
  if (parentid) {
    targetObj = treeutil.findNodeById(treeObj, parentid);
    if (!targetObj) throw { err: 'SOFTERR', message: 'Not found parent node ' + parentid };
  } else targetObj = treeObj;

  const { startOrder, delta, targetIdx, needReorder } = calculateOrder(targetObj.children, previd, qItems);

  let shifted;
  if (needReorder) {
    shifted = await reordering(targetObj.children, targetIdx, treeDesc, startOrder + qItems * delta);
  }

  
  let nextOrder = startOrder + delta;
  let seqObj;
  if (seq) {
    seqObj = createSeqObj(startOrder, delta, seq);
    console.log('seqObj='+util.inspect(seqObj));

  } else if (Array.isArray(payloadItem)) {
    setNewOrder(payloadItem);
  } else {
    if (payloadItem.folders && Array.isArray(payloadItem.folders)) {
      setNewOrder(payloadItem.folders);
    }
    if (payloadItem.nodes && Array.isArray(payloadItem.nodes)) {
      setNewOrder(payloadItem.nodes);
    }
  }

  return { startOrder, delta, shifted, seqObj };

  function setNewOrder(arr) {
    arr.forEach(item => {
      item.order = nextOrder;
      nextOrder += delta;
    });
  }
}


function getQItems(payloadItem) {
  if (Array.isArray(payloadItem)) return payloadItem.length;
  let q = 0;
  if (payloadItem.folders && Array.isArray(payloadItem.folders)) {
    q += payloadItem.folders.length;
  }
  if (payloadItem.nodes && Array.isArray(payloadItem.nodes)) {
    q += payloadItem.nodes.length;
  }
  return q;
}

function createSeqObj(startOrder, delta, seq) {
  const seqObj = {};
  seq.forEach((el, idx) => {
    seqObj[el] = startOrder + delta * (idx + 1);
  });
  return seqObj;
}

/**
 * Вычислить order для узлов из children
 *  - возвращает значения для расчета вставляемых узлов
 *    и значения для сдвига, если нужно
 *
 * @param {Array of Objects} children - содержит массив узлов дерева
 * @param {String} previd - id узла, ПОСЛЕ которого нужно вставить узел (узлы)
 * @param {Number} qItems -число узлов для вставки
 *
 * @return {Object}  { startOrder, delta, targetIdx, needReorder}
 *         startOrder - значение order узла, ПОСЛЕ которого будет вставка
 *         delta - приращение при нумерации вставляемых узлов
 *               Если вставка в пустой массив, то startOrder=0, delta=1000 => order=0+1000
 *        targetIdx - индекс в children значения startOrder (узел, после которого будет вставка)
 *        needReorder - true, если существующие узлы, следующие после targetIdx, нужно перенумеровать
 *
 */
function calculateOrder(children, previd, qItems = 1) {
  let startOrder = 0;
  let delta = 1000;
  let targetIdx = -1;

  // previd - спец: _top, _bottom
  const lastIdx = children.length - 1;

  if (lastIdx >= 0) {
    // Массив не пустой - вставить в конец по дефолту, delta = 1000 (не определено или _bottom)
    targetIdx = lastIdx;
    startOrder = children[targetIdx].order;

    // Если previd определен - ищем его в массиве
    if (previd && previd != '_bottom') {
      if (previd == '_top') {
        targetIdx = -1;
        startOrder = 0;
        delta = getDelta(0, children[0].order, qItems);
      } else  {
      
      targetIdx = children.findIndex(item => item.id == previd);
      if (targetIdx >= 0 && targetIdx < children.length - 1) {
        // Не последний - нужно вставить внутрь
        startOrder = children[targetIdx].order;
        delta = getDelta(startOrder, children[targetIdx + 1].order, qItems);
      } // иначе добавление будет в конец
    }
  }
  } // если вставляем в пустую папку - все по def, двигать ничего не надо

  let needReorder;
  if (delta < 2) { // Может быть и отрицательное значение
    delta = 1000;
    needReorder = true;
  }
  return { startOrder, delta, targetIdx, needReorder };
}

function getDelta(prevOrder, nextOrder, q) {
  return Math.round((nextOrder - prevOrder) / (q + 1));
}

/**
 * Перенумеровать сдвинутые узлы из children
 *  - пишет новые order в таблицы (leaf, branch)
 *  - возвращает объект с перенумерованными узлами для передачи в response
 *
 * @param {Array of Objects} children - содержит массив узлов дерева для reordering
 * @param {Number} targetIdx - индекс в children. Элементы, следующие за targetIdx, будут перенумерованы
 * @param {Object} desc - дескриптор дерева (для извлечения имен таблиц)
 * @param {Number} nextOrder - значение следующего order
 *
 * @return {Object}  {"d042":2000, "dg17":3000 }
 */
async function reordering(children, targetIdx, desc, nextOrder) {
  if (!children) throw { err: 'SOFTERR', message: 'Expected children in targenObj for reordering!' };
  if (targetIdx < 0 || !children.length || targetIdx > children.length - 1) return;

  const reorder = {};
  const l_arr = [];
  const b_arr = [];
  const oneTable = desc.leaf.table == desc.branch.table;

  let order = nextOrder;
  for (let i = targetIdx + 1; i < children.length; i++) {
    const item = children[i];
    order += 1000;
    reorder[item.id] = order;

    if (item.children && !oneTable) {
      b_arr.push({ nodeid: item.id, order });
    } else {
      l_arr.push({ nodeid: item.id, order });
    }
  }

  if (oneTable) {
    await updateNodeOrders(l_arr, desc.leaf.table);
  } else {
    if (l_arr.length) await updateNodeOrders(l_arr, desc.leaf.table); // таблицы разные!!
    if (b_arr.length) await updateNodeOrders(b_arr, desc.branch.table);
  }
  return reorder;
}

async function updateNodeOrders(nodes, table) {
  const tdesc = descriptor.getDescItem('table', table);

  try {
    for (const item of nodes) {
      if (item.nodeid) {
        await dm.dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: { order: item.order } });
      }
    }
  } catch (e) {
    throw { message: 'Update NodeOrders error:' + e.message };
  }
}

module.exports = {
  exec
};
