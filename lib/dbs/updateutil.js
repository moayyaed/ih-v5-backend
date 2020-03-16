/**
 *  updateutil.js
 */

const util = require('util');

const dbstore = require('./dbstore');
const descriptor = require('./descriptor');

async function processTheNodeOrder(children, theNode, desc) {
  let shifted;

  console.log('in processTheNodeOrder start children= ' + util.inspect(children));
  const { startOrder, delta, targetIdx, needReorder } = calculateOrder(children, theNode);
  // Сформировать order для узла, если не совпадает - будет изменен перед записью
  let order = startOrder + delta;

  // Если не смогли поместиться - нужно перенумеровать элементы следующие за targetIdx
  if (needReorder) {
    shifted = await reordering(children, targetIdx, desc, startOrder + delta);
  }
  console.log('in processTheNodeOrder order=' + order +' shifted='+util.inspect(shifted));

  return { order, shifted };
}

function calculateOrder(children, target, seq) {
  const qItems = seq ? seq.length : 1;
  let startOrder = 1000;
  let delta = 1000;
  let targetIdx;
  let needReorder;
  let targetorder;

  const lastIdx = children.length - 1;

  if (typeof target == 'object') {
    // Передают готовый объект, order уже посчитан (при вставке или сдвиге)
    // Ищем пару, между которой нужно вставить
    targetorder = target.order ? target.order : 0;
    targetIdx = children.findIndex(item => item.order >= targetorder);

    if (targetIdx > 0) {
      targetIdx--;
      startOrder = children[targetIdx].order; // start - предыдущий
      delta = getDelta(children[targetIdx].order, children[targetIdx + 1].order, 1);
    } else {
      targetIdx = lastIdx;
      startOrder = targetIdx >= 0 ? children[targetIdx].order : 1000;
    }
  } else if (lastIdx >= 0) {
    // при копировании нужно считать order
    // если вставляем в пустую папку - все по def, двигать ничего не надо

    // Если targetorder определен - ищем его в массиве, иначе в конец
    if (targetorder) {
      targetIdx = children.findIndex(item => item.order >= targetorder);
      if (targetIdx >= 0 && targetIdx < children.length - 1) {
        startOrder = children[targetIdx].order;
        delta = getDelta(startOrder, children[targetIdx + 1].order, qItems);
      } else {
        targetIdx = children.length - 1;
        startOrder = children[targetIdx].order;
      }
    }
  }

  if (delta < 2) {
    delta = 1000;
    needReorder = true;
  }
  return { startOrder, delta, targetIdx, needReorder };
}

function getDelta(prevOrder, nextOrder, q) {
  return Math.round((nextOrder - prevOrder) / (q + 1));
}

/**
 * Перенумеровать все узлы следующие за targetIdx
 * @param {*} targetObj
 * @param {*} targetIdx
 * @param {*} desc
 * @param {*} nextOrder
 */
async function reordering(children, targetIdx, desc, nextOrder) {
  console.log('reordering START');
  if (!children) throw { err: 'SOFTERR', message: 'Expected children in targenObj for reordering!' };

  if (targetIdx < 0 || !children.length || targetIdx > children.length - 1) return;

  const reorder = {};
  const l_arr = [];
  const b_arr = [];

  let order = nextOrder;
  for (let i = targetIdx + 1; i < children.length; i++) {
    const item = children[i];
    const id = item.id;
    order += 1000;
    reorder[id] = order; // для того чтобы отдать в response

    if (item.children) {
      b_arr.push({ nodeid: id, order });
    } else {
      l_arr.push({ nodeid: id, order });
    }
  }

  if (l_arr.length) await updateNodeOrders(l_arr, desc.leaf.table); // таблицы разные!!
  if (b_arr.length) await updateNodeOrders(b_arr, desc.branch.table);

  return reorder;
}

async function updateNodeOrders(nodes, table) {
  const tdesc = descriptor.getDescItem('table', table);
  console.log('updateNodeOrders =' + table + util.inspect(nodes));
  try {
    for (const item of nodes) {
      if (item.nodeid) {
        const doc = { order: item.order };
        if (item.parentid) doc.parent = item.parentid;

        await dbstore.update(tdesc.collection, { _id: item.nodeid }, { $set: doc });
      }
    }
  } catch (e) {
    throw { message: 'Update NodeOrders error:' + e.message };
  }
}

module.exports = {
  processTheNodeOrder,
  calculateOrder,
  reordering
};
