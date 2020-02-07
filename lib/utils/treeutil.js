/**
 *  treeutil.js
 * 
 *  Функции формирования и работы со структурой дерево
 *  Метод хранения исходных данных для дерева - cписок смежности (Adjacency List) (code, parent_code)
 *  Таким образом, входящий массив для формирования: [{id, parent, order, ....title ...}] 
 * 
 *  Результирующее дерево - массив, вложенные узлы хранятся как массивы children, уровень вложения не ограничен
 *  Узлы листьев массива children не имеют
 *  Массив правильного дерева (найдены все записи для parent) состоит из 1 элемента, root элемент обычно имеет parent:0
 *
 *  Если узел имеет parent, записи для которого нет, то он добавляется на верхний уровень массива   
   [
      {
        id: 'type_root',
        order: 0,
        title: 'Все типы',
        parent:0,
        children: [
          { id: 't100', title: 'Sensor',  parent:'type_root', order: 100, children: [
              { id: 't101', title: 'Analog sensor', parent:'t100', order: 100, children: [
                { id: '71515', title: 'Temperature', parent:'t101', order: 100},
                { id: '725', title: 'Humidity',  parent:'t101', order: 200}
              ]}
          ]},
          { id: 't200', title: 'Rele', parent:'type_root', order: 200, children: [] }
        ]
      },

      // Parent some_node не наден
      {
        id: 'someid',
        order: 0,
        parent:'some_node',
        children: [ здесь могут быть элементы, если потерян только верхний узел!]
      }
    ] 
 *
 *  Упорядочивание по вертикали (внутри ветки) - по полю order
 *  
 */

// const util = require('util');

/**
 * Создание дерева без разделения на ветви и листья
 * (все узлы будут иметь массив children, возможно, пустой)
 *
 * @param {Array} data - входящий массив
 * @return {Array} - исходящий массив - деревья
 *
 * Если входной массив упорядочен по order, упорядочивание происходит автоматически
 * при добавлении однородных элементов
 *
 */
function makeTree(data) {
  const temp = {};
  data.forEach(item => {
    item.children = [];
    temp[item.id] = item;
  });

  const tree = [];
  data.forEach(item => {
    if (temp[item.parent]) {
      temp[item.parent].children.push(item);
    } else tree.push(item);
  });
  return tree;
}

/**
 * Создание дерева с разделением на ветви и листья. Выполяется упорядочивание по order
 *
 * @param {Array} data - входящий массив ветвей
 * @param {Array} leaves - входящий массив листьев. Листья не имеют children
 * @return {Array} - исходящий массив - деревья
 *
 * В исходящих элементах удаляются поля parent и list (если есть), остальные переносятся как есть
 * Добавляется поле order=1 (при отсутствии)
 *
 */
function makeTreeWithLeaves(data, leaves) {
  const temp = {}; // Ссылки на узлы - ветки
  data.forEach(item => {
    item.children = [];
    if (!item.order) item.order = 1;
    temp[item.id] = item;
  });

  const leaftemp = {}; // Листья собираются по parent в массивы
  leaves.forEach(item => {
    if (!leaftemp[item.parent]) leaftemp[item.parent] = [];
    if (!item.order) item.order = 1;
    leaftemp[item.parent].push(item);
    delete item.parent;
  });

  const tree = [];
  data.forEach(item => {
    if (leaftemp[item.id] && leaftemp[item.id].length > 0) {
      for (let i = 0; i < leaftemp[item.id].length; i++) {
        addItemByOrder(temp[item.id].children, leaftemp[item.id][i]);
      }
      delete leaftemp[item.id];
    }

    if (temp[item.parent]) {
      addItemByOrder(temp[item.parent].children, item);
      delete item.parent;
      delete item.list;
    } else tree.push(item);
  });

  // Если остались листья, сгруппированные по parent, который не найден - записать на первый уровень (как корень)
  if (Object.keys(leaftemp).length > 0) {
    Object.keys(leaftemp).forEach(parent => {
      leaftemp[parent].forEach(leaf => {
        leaf.parent = parent;
        tree.push(leaf);
      });
    });
  }
  return tree;
}

/**
 *  Вспомогательная функция вставки элемента в порядке order
 *  Если входящие массивы упорядочены, итераций будет меньше
 * @param {Array} arr - массив для вставки
 * @param {Object} item - вставляемый элемент, должен содержать свойство order
 */
function addItemByOrder(arr, item) {
  const len = arr.length;
  if (arr.length <= 0 || arr[len - 1].order < item.order) return arr.push(item);
  let i = len - 1;
  while (i > 0 && arr[i].order < item.order) {
    i--;
  }
  arr.splice(i, 0, item);
}

/**
 * Возвращает массив узлов, являющихся потомками (все вложенные узлы)
 * 
 * @param {Object} tree - поддерево с одним корнем, вложенные массивы children
 * @return {Array of Objects} - плоский массив элементов [{id,.. }, {id,..}] 
 *
 */
function findAllDescendants(treeObj) {
  const resut = [];
  traverse(treeObj);
  return resut;

  function traverse(tobj) {
    if (!tobj.children || !tobj.children.length) return;
    tobj.children.forEach(child => {
      resut.push(child);
      traverse(child);
    });
  }
}

/**
 * Возвращает узел дерева по id
 * 
 * @param {Object} tree - поддерево с одним корнем, вложенные массивы children
 * @return {Objects || undfined} - найденный узел (поддерево)
 *
 */
function findNodeById(tobj, id) {
  if (tobj.id == id) return tobj;

  if (!tobj.children) return; // Не нашли
  for (let i = 0; i < tobj.children.length; i++) {
    const res = findNodeById(tobj.children[i], id);
    if (res) return res;
  }
}

/**
 * Обрабатывает дерево, чтобы у него остался только один корень
 * Остальные узлы, оказавшиеся на верхнем уровне, перемещает в папку lost+found
 *   Папка lost+found создается как дочерняя для корня, только если есть такие элементы
 * 
 * @param {Object} data - массив деревьев (несколько корней)
 * @param {String} id - идентификатор дерева (только для создания id папки lost+found)
 */
function moveToLost(data, id) {
  const lostNode = { id: 'lost_' + id, title: 'lost+found', children: [] };

  // Найти основной корень: parent=0 & children.length больше
  let rootIdx = -1;
  data.forEach((item, idx) => {
    if (!item.parent && item.children) {
      if (rootIdx < 0 || item.children.length > data[rootIdx].children.length) rootIdx = idx;
    }
  });

  // Должен остаться ровно один корень
  if (rootIdx < 0) rootIdx = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (i != rootIdx) {
      const item = data[i];
      lostNode.children.push(item);
      data.splice(i, 1);
    }
  }

  // Вставить папку lost в оставшийся корень
  data[0].children.push(lostNode);
}

function gatherBranchsAndLeavesIdsForBranch(tree, branch_id) {
  const subtree = findNodeById(tree, branch_id);

  // Разделить на ветки и листья, так как это разные таблицы
  const b_arr = [branch_id]; // Удаляемая ветка
  const l_arr = [];
  if (subtree) {
    const siblingArr = findAllDescendants(subtree);

    siblingArr.forEach(item => {
      if (item.children) {
        b_arr.push(item.id);
      } else {
        l_arr.push(item.id);
      }
    });
  }
  return { b_arr, l_arr };
}

module.exports = {
  findNodeById,
  findAllDescendants,
  makeTree,
  makeTreeWithLeaves,
  moveToLost,
  gatherBranchsAndLeavesIdsForBranch
};
