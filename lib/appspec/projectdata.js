/**
 * projectdata.js
 * Обработка файлов проекта
 *
 *
 */

const util = require('util');

const dm = require('../datamanager');
const hut = require('../utils/hut');
const loadsys = require('../utils/loadsys');
const datagetter = require('./datagetter');

async function getDataVis(cmd, query, holder) {
  if (query.rt || query.static) return getRtData(cmd, query, holder);

  switch (cmd) {
    case 'layout':
      return getCachedProjectObj('layout', query.id);

    case 'container':
    case 'template':
    case 'dialog':
      return getCachedProjectObj(cmd, query.id);

    case 'templates':
      if (query.containerid) {
        // Все темплэйты для контейнера
        return joinTemplatesForContainer(query.containerid);
      }
      if (query.layoutid) {
        // Все темплэйты контейнеров для экрана
        return joinTemplatesForLayout(query.layoutid);
      }
      throw { err: 'SOFTERR', message: "Expected 'containerid' or 'layoutid' in query!" };

    case 'containers':
      // Все контейнеры для экрана
      if (query.layoutid) {
        return joinContainersForLayout(query.layoutid, holder);
      }
      throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

    default:
      throw { err: 'SOFTERR', message: 'Unknown command in query: ' + cmd };
  }
}

async function getRtData(cmd, query, holder) {
  switch (cmd) {
    case 'layout':
    case 'dialog':
      // return getRtForContainerElements(cmd, query.id, holder);
      return getRtForContainerElements(cmd, query, holder);

    case 'containers':
      if (query.layoutid) {
        return joinContainersRtForLayout(query.layoutid, holder);
      }
      throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

    default:
      throw { err: 'SOFTERR', message: 'Unknown command in query for rt: ' + cmd };
  }
}

async function joinTemplatesForContainer(containerId) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('container', containerId);
  const ids = gatherTemplateIdsFromContainerData(dataObj);

  for (const id of ids) {
    resObj[id] = await getCachedProjectObj('template', id);
  }
  return resObj;
}

/** Выбирается templateId - идентификатор шаблона, м б несколько раз!! */
function gatherTemplateIdsFromContainerData(dataObj) {
  const ids = [];
  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(elName => {
      if (
        dataObj.elements[elName].type &&
        dataObj.elements[elName].type == 'template' &&
        dataObj.elements[elName].templateId
      ) {
        ids.push(dataObj.elements[elName].templateId);
      }
    });
  }
  return ids;
}

// async function joinContainersForLayout(layoutId, holder) {
async function joinContainersForLayout(layoutId) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('layout', layoutId);
  const ids = gatherContainerIdsFromLayoutData(dataObj);

  for (const id of ids) {
    const data = await getCachedProjectObj('container', id); // Файл контейнера
    resObj[id] = data;
  }
  return resObj;
}

async function joinContainersRtForLayout(layoutId, holder) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('layout', layoutId);

  const ids = gatherContainerIdsFromLayoutData(dataObj);
  for (const id of ids) {
    const oneCont = await getRtForContainerElements('container', { id }, holder);
    // const oneCont = await getRtForContainerElements('container', id, holder);
    Object.assign(resObj, oneCont);
  }
  return resObj;
}

/* Возвращает значения переменных для контейнера или экрана
 */
// async function getRtForContainerElements(id, nodeid, holder) {
async function getRtForContainerElements(id, query, holder) {
  const nodeid = query.id;
  const cObj = await getCachedUpProjectObj({ id, nodeid });

  const res = {};
  const uppobj = cObj.data;

  Object.keys(uppobj).forEach(did => {
    Object.keys(uppobj[did]).forEach(prop => {
      if (isProp(holder, did, prop)) {
        if (!res[did]) res[did] = {};
        if (query.static) {
          res[did] = getStaticObj(holder, did, prop);
        } else {
          res[did][prop] = getPropVal(holder, did, prop);
        }
      }
    });
  });
  return res;
}

function isGlobalVar(did) {
  return did && did.startsWith('gl');
}

function isLocalVar(did) {
  return did && did.startsWith('local');
}

function isProp(holder, did, prop) {
  if (!did || !prop) return;

  return (
    (isGlobalVar(did) && holder.glSet.getItem(did) != undefined) ||
    isLocalVar(did) ||
    (holder.devSet[did] && holder.devSet[did][prop] != undefined)
  );
}

function getStaticObj(holder, did) {
  if (!holder.devSet[did]) return {};
  const dobj = holder.devSet[did];

  // Получить placeArr и placeStr
  const placePath = datagetter.getDevicePlacePath(did, holder);
  // const placePath = datautil.getPathFromTree('devdevices', did, 'place');
  const placeArr = placePath.split('/');
  const res = { dn: dobj.dn, name: dobj.name, sys: dobj.sys, placePath, placeArr };
  res.placeStr = placeArr.join(' ');

  const props = dobj.getPropsForVislink();
  if (props) {
    props.forEach(prop => {
      res[prop] = dobj.getPropValue(prop);
    });
  }

  return res;
}

function getPropVal(holder, did, prop) {
  if (!did || !prop) return 0;

  if (isGlobalVar(did)) return holder.glSet.getValue(did) || 0;

  if (isLocalVar(did)) {
    // Отдать дефолтное значение
    const item = datagetter.getListItem('localList', did);
    return item ? item.defval : 0;
  }

  return holder.devSet[did][prop] || 0;
}

function gatherContainerIdsFromLayoutData(dataObj) {
  const ids = [];

  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(name => {
      if (
        dataObj.elements[name].type &&
        dataObj.elements[name].type == 'container' &&
        dataObj.elements[name].containerId &&
        dataObj.elements[name].containerId.id
      ) {
        ids.push(dataObj.elements[name].containerId.id);
      }
    });
  }
  return ids;
}

async function joinTemplatesForLayout(layoutId) {
  const dataObj = await getCachedProjectObj('layout', layoutId);
  const cids = gatherContainerIdsFromLayoutData(dataObj);

  // Собрать из контейнеров id templates - могут быть повторения
  const tempSet = new Set();
  for (const id of cids) {
    const contData = await getCachedProjectObj('container', id);
    const tids = gatherTemplateIdsFromContainerData(contData);
    tids.forEach(tid => {
      tempSet.add(tid);
    });
  }

  const resObj = {};
  const ids = Array.from(tempSet);
  for (const id of ids) {
    resObj[id] = await getCachedProjectObj('template', id);
  }
  return resObj;
}

async function getCachedProjectObj(id, nodeid) {
  const cachedObj = await dm.getCachedData({ type: 'pobj', id, nodeid }, getProjectObj);
  if (!cachedObj) throw { error: 'SOFTERR', message: 'No cached project object ' + id + ' ' + nodeid };
  return cachedObj.data;
}

async function getProjectObj({ id, nodeid }) {
  // Загрузить объект из соотв папки проекта.
  const folders = ['layout', 'container', 'template', 'dialog'];
  if (!folders.includes(id)) throw { err: 'SOFTERR', message: 'Unknown project object id: ' + id };

  return loadsys.loadProjectJson(id, nodeid);
}

// {id:'container' || 'layout', nodeid: container id || layout id}
async function getCachedUpProjectObj({ id, nodeid }) {
  return dm.getCachedData({ type: 'uppobj', id, nodeid, method: 'get' }, getUpPobj);
}

async function getUpPobj(query) {
  const { id, nodeid } = query;
  const res = {};

  // Получить исходный объект
  const pobj = await getCachedProjectObj(id, nodeid);
  if (!pobj || !pobj.elements) return {};

  // Вывернуть по did
  Object.keys(pobj.elements).forEach(el => {
    if (pobj.elements[el] != null && typeof pobj.elements[el] == 'object') {
      Object.keys(pobj.elements[el]).forEach(visprop => {
        if (pobj.elements[el][visprop] != null && typeof pobj.elements[el][visprop] == 'object') {
          // Найти свойства с enabled
          if (pobj.elements[el][visprop].enabled) {
            addToRes(pobj.elements[el][visprop].did, pobj.elements[el][visprop].prop, { el });
          } else if (visprop == 'actions') {
            if (pobj.elements[el][visprop].type == 'multi') {
              Object.keys(pobj.elements[el][visprop]).forEach(key => {
                if (key.startsWith('action')) {
                  const item = pobj.elements[el][visprop][key];
                  if (item.left) processActionsArray(item.left, el);
                  if (item.right) processActionsArray(item.right, el);
                }
                /* "actions": {
                  "type": 'multi',
                  "action_1": {
                   "right: [],
                   "left": [
                     {"did": "d0003", "prop": "auto", "command": "setval",  "action": "singleClickLeft", "title": "H102 ▪︎ Светильник ▪︎ auto","func": "return inData + 1;},
                     { "action": "doubleClickLeft","value": {}}]},
                  "action_2": {
                   "right: [],
                   "left": []
                  }
                 } */
              });
            } else {
              /* "actions": {
              "right: [],
              "left": [
              {"did": "gl002", "prop": "guard", "command": "setval",  "action": "singleClickLeft", "title": "globals.guard","func": "return inData + 1;},
              { "action": "doubleClickLeft","value": {}}]}
              */
              const item = pobj.elements[el][visprop];
              if (item.left) processActionsArray(item.left, el);
              if (item.right) processActionsArray(item.right, el);
            }
          }
        }
      });

      // Если template - также обработать links
      if (
        pobj.elements[el].type == 'template' &&
        pobj.elements[el].links &&
        typeof pobj.elements[el].links == 'object'
      ) {
        const links = pobj.elements[el].links;
        Object.keys(links).forEach(varname => {
          if (typeof links[varname] == 'object') {
            addToRes(links[varname].did, links[varname].prop, { el, varname });
          }
        });
      }
    }
  });
  return res;

  function processActionsArray(arr, el) {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (item && item.command == 'setval') {
        addToRes(item.did, item.prop, { el: el + '.' + item.action });
      }
    });
  }

  function addToRes(did, prop, elObj) {
    if (did && prop) {
      if (!res[did]) res[did] = {};
      if (!res[did][prop]) res[did][prop] = [];
      res[did][prop].push(elObj);
    }
  }
}

/**
 * Выбрать массив элементов, использующих шаблон templateId в контейнере containerId
 * @param {String} templateId - id шаблона
 * @param {String} containerId - id контейнера
 * @return {Array of Strings} :["template_1",...] - имена элеменов контейнера, использующих шаблон
 */
async function findTemplateUsageForContainer(templateId, containerId) {
  const res = [];
  const dataObj = await getCachedProjectObj('container', containerId);
  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(elName => {
      if (dataObj.elements[elName].type == 'template' && dataObj.elements[elName].templateId == templateId) {
        res.push(elName);
      }
    });
  }
  return res;
}

/**
 * Сравнить шаблон с предыдущим состоянием
 * Найти удаленные переменные и action_x
 * Вернуть удаленные элементы в массиве
 *  @param  {Object} prevObj
 *  @param  {Object} newObj
 *  @return {Array of String}  ['state3', 'state23', 'action_1']
 */
function findRemovedVarsAndActionsForTemplate(prevObj, newObj) {
  if (!prevObj || !newObj || typeof prevObj != 'object' || typeof newObj != 'object') return [];
  let removedVar = [];
  if (prevObj.listState && newObj.listState) {
    removedVar = hut.arrayDiff(prevObj.listState, newObj.listState);
  }

  let removedAction = [];
  if (prevObj.list && newObj.list) {
    removedAction = prevObj.list.filter(el => el.startsWith('action_') && !newObj.list.includes(el));
  }

  return [...removedVar, ...removedAction];
}

/**
 * Берет текущий объект контейнера, удаляет из него элементы из removed
 * Если есть изменения - возвращает новый объект для сохранения?
 *
 *  @param  {String} id  ID контейнера
 *  @param  {String} templateId  ID шаблона
 *  @param  {Array of String} removed - удаленные переменные и action шаблона
 *                            ['state3', 'state23', 'action_1']
 *  @return {Object || ''}
 */
async function removeVarsAndActionsFromContainer(id, templateId, removed) {
  if (!id || !templateId || !removed || !removed.length) return '';

  let changed = false;
  const removedVars = removed.filter(el => !el.startsWith('action_'));
  const removedActions = removed.filter(el => el.startsWith('action_'));

  const dataObj = await getCachedProjectObj('container', id); // Файл контейнера

  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(elName => {
      // Один шаблон может встретиться несколько раз
      if (dataObj.elements[elName].type == 'template' && dataObj.elements[elName].templateId == templateId) {
        if (removedVars.length && dataObj.elements[elName].links) {
          removedVars.forEach(el => {
            if (dataObj.elements[elName].links[el]) {
              delete dataObj.elements[elName].links[el];
              changed = true;
            }
          });
        }

        if (removedActions.length && dataObj.elements[elName].actions) {
          Object.keys(dataObj.elements[elName].actions).forEach(key => {
            // key =  "action_1_singleClickLeft"
            removedActions.forEach(el => {
              if (key.startsWith(el)) {
                delete dataObj.elements[elName].actions[key];
                changed = true;
              }
            });
          });
        }
      }
    });
  }
  return changed ? dataObj : '';
}

module.exports = {
  getDataVis,
  getUpPobj,
  getCachedProjectObj,
  getCachedUpProjectObj,
  findTemplateUsageForContainer,
  findRemovedVarsAndActionsForTemplate,
  removeVarsAndActionsFromContainer
};
