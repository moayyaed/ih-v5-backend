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

async function getDataVis(cmd, query, holder) {
  let data;
  switch (cmd) {
    case 'layout':
      // return query.rt ? '' : getCachedProjectObj(cmd, query.id);
      data = await getCachedProjectObj('layout', query.id); // Файл контейнера
      return query.rt ? getRtForContainerElements(data, holder) : data;

    case 'container':
    case 'template':
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
        return joinContainersForLayout(query.layoutid, query.rt, holder);
      }
      throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

    default:
      throw { err: 'SOFTERR', message: 'Unknown command in query: ' + cmd };
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

async function joinContainersForLayout(layoutId, rt, holder) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('layout', layoutId);
  const ids = gatherContainerIdsFromLayoutData(dataObj);
  for (const id of ids) {
    const data = await getCachedProjectObj('container', id); // Файл контейнера
    resObj[id] = rt ? getRtForContainerElements(data, holder) : data;
  }
  return resObj;
}

function getRtForContainerElements(data, holder) {
  const res = {};
  if (data && data.elements && typeof data.elements == 'object') {
    Object.keys(data.elements).forEach(el => {
      if (typeof data.elements[el] == 'object') {
        //  Искать свойства с enabled
        Object.keys(data.elements[el]).forEach(visprop => {
          if (typeof data.elements[el][visprop] == 'object' && data.elements[el][visprop].enabled) {
            const did = data.elements[el][visprop].did;
            const prop = data.elements[el][visprop].prop;
            if (isProp(holder, did, prop)) {
              if (!res[el]) res[el] = {};
              if (!res[el][did]) res[el][did] = {};
              res[el][did][prop] = getPropVal(holder, did, prop); // Будет отправлено did, prop для el, visprop обрабатывается на фронте
            }
            /*
            if (did && prop && holder.devSet[did] && holder.devSet[did][prop] != undefined) {
              if (!res[el]) res[el] = {};
              if (!res[el][did]) res[el][did] = {};
              res[el][did][prop] = isGlobalVar(did) ? holder.glSet[did].value : holder.devSet[did][prop]; // Будет отправлено did, prop для el, visprop обрабатывается на фронте
            }
            */
          }
        });
      }

      // Для template -
      if (data.elements[el].type == 'template') {
        const states = {};
        if (typeof data.elements[el].links == 'object') {
          Object.keys(data.elements[el].links).forEach(name => {
            const { did, prop } = data.elements[el].links[name];
            states[name] = getPropVal(holder, did, prop); // Значение получить из holder по did, prop
            // states[name] = holder.devSet[did] ? holder.devSet[did][prop] : 0; 
          });

          if (!hut.isObjIdle(states)) {
            if (!res[el]) res[el] = {};
            Object.assign(res[el], states);
          }
        }
      }
    });
  }
  return res;
}

function isGlobalVar(did) {
  return did.startsWith('gl');
}

function isProp(holder, did, prop) {
  if (!did || !prop) return;

  return isGlobalVar(did)
    ? holder.glSet[did] && holder.glSet[did].value != undefined
    : holder.devSet[did] && holder.devSet[did][prop] != undefined;
}

function getPropVal(holder, did, prop) {
  if (!did || !prop) return 0;
  const val = isGlobalVar(did) ? holder.glSet[did].value : holder.devSet[did][prop];
  return val == undefined ? 0 : val;
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
  const folders = ['layout', 'container', 'template'];
  if (!folders.includes(id)) throw { err: 'SOFTERR', message: 'Unknown project object id: ' + id };

  return loadsys.loadProjectJson(id, nodeid);
}

// {id:container, nodeid: container id}
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
      // Для всех - найти свойства с enabled
      Object.keys(pobj.elements[el]).forEach(visprop => {
        if (
          pobj.elements[el][visprop] != null &&
          typeof pobj.elements[el][visprop] == 'object' &&
          pobj.elements[el][visprop].enabled
        ) {
          const did = pobj.elements[el][visprop].did;
          const prop = pobj.elements[el][visprop].prop;
          if (did && prop) {
            if (!res[did]) res[did] = {};
            if (!res[did][prop]) res[did][prop] = [];
            res[did][prop].push({ el }); // Будет отправлено did, prop для el, visprop обрабатывается на фронте
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
            const did = links[varname].did;
            const prop = links[varname].prop;
            if (did && prop) {
              if (!res[did]) res[did] = {};
              if (!res[did][prop]) res[did][prop] = [];
              res[did][prop].push({ el, varname });
            }
          }
        });
      }
    }
  });
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

/*
"elements": {
        "template_1": {
          "type": "template",
           ...
          "links": {
            "state1": {
              "did": "d0002",
              "dn": "AI001",
              "name": "Датчик аналоговый тест поступления данных",
              "prop": "value",
              "title": "AI001 ▪︎ Датчик аналоговый тест поступления данных ▪︎ value",
              "value": {
                "did": "d0002",
                "prop": "value"
              }
            }
          },
          "templateId": "vt023",
          "actions": {
            "action_1_singleClickLeft": {
              "did": "d0005",
              "dn": "AD002",
              "name": "Актуатор дискретный",
              "prop": "toggle",
              "title": "AD002 ▪︎ Актуатор дискретный ▪︎ toggle",
              "value": {
                "did": "d0005",
                "prop": "toggle"
              }
            }
          }
        }
      },
  */

module.exports = {
  getDataVis,
  getCachedProjectObj,
  getCachedUpProjectObj,
  findTemplateUsageForContainer,
  findRemovedVarsAndActionsForTemplate,
  removeVarsAndActionsFromContainer
};
