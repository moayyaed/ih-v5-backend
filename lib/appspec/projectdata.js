/**
 * projectdata.js
 * Обработка запросов на получение данных визуализации проекта (экраны, контейнеры, диалоги)
 *
 *
 */

const util = require('util');

const hut = require('../utils/hut');
const loadsys = require('../utils/loadsys');

const domaindata = require('../domain/domaindata');

async function getDataVis(cmd, query, holder) {
  if (query.rt || query.static) return getRtData(cmd, query, holder);
  // if (query.widgetdata) return getWidgetdata(cmd, query, holder);
  const dm = holder.dm;
  const frames = query.frames ? parseFrames(query.frames) : ''; // [{frame:frame_4, vc: vc002, device:d007}]

  let layoutObj;
  switch (cmd) {
    case 'layout':
      layoutObj = await getCachedProjectObj('layout', query.id, dm);
      // Если есть frames - подставить их иначе вернуть дефолтный
      return frames ? replaceFramesForLayout(layoutObj, frames) : layoutObj;
    // return layoutObj;

    case 'container':
    case 'template':
    case 'dialog':
      return getCachedProjectObj(cmd, query.id, dm);

    case 'templates':
      if (query.containerid) {
        // Все темплэйты для контейнера
        return joinTemplatesForContainer(query.containerid, holder);
      }
      if (query.layoutid) {
        // Все темплэйты контейнеров для экрана
        return joinTemplatesForLayout(query.layoutid, holder);
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

function parseFrames(frameStr) {
  // console.log('parseFrames '+frameStr)
  if (!frameStr) return;
  const arr = frameStr.split(';');
  let res = {};
  arr
    .filter(item => item)
    .forEach(item => {
      const elems = item.split(',');
      if (elems.length > 1 && elems[0] && elems[1]) {
        // frame_1,vc002,d042
        const [frame, vc, device] = elems;
        if (!res) res = {};
        res[frame] = { vc, device };
      }
    });
    // console.log('parseFrames res='+util.inspect(res))
  return res;
}

function replaceFramesForLayout(layoutObj, frameObj) {
  // Объект НУЖНО клонировать!!
  const dataObj = hut.clone(layoutObj);
  // Найти в elements!!
  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(name => {
      if (
        dataObj.elements[name].type &&
        dataObj.elements[name].type == 'container' &&
        frameObj[name] &&
        dataObj.elements[name].widgetlinks &&
        dataObj.elements[name].widgetlinks.link &&
        dataObj.elements[name].widgetlinks.link.id
      ) {
        dataObj.elements[name].widgetlinks.link.id = frameObj[name].vc;
        // if ()  device
      }
    });
  }

  return dataObj;
}

async function getRtData(cmd, query, holder) {
  let res = {};
  switch (cmd) {
    case 'layout':
    case 'container':
      // return getRtForContainerElements(cmd, query, holder);
      res = await getRtForContainerElements(cmd, query, holder);
      if (query.contextId) {
        // Добавить если есть устройство контекст
        res[query.contextId] = getStaticObj(holder, query.contextId, '');
      }
      return res;

    case 'dialog':
      // return getRtForContainerElements(cmd, query.id, holder);
      res = await getRtForContainerElements(cmd, query, holder);
      if (query.contextId) {
        // Добавить если есть устройство контекст
        res[query.contextId] = getStaticObj(holder, query.contextId, '');
      }
      return res;

    case 'containers':
      if (query.layoutid) {
        return joinContainersRtForLayout(query.layoutid, holder);
      }
      throw { err: 'SOFTERR', message: "Expected 'layoutid' in query!" };

    default:
      throw { err: 'SOFTERR', message: 'Unknown command in query for rt: ' + cmd };
  }
}

async function joinTemplatesForContainer(containerId, holder) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('container', containerId, holder.dm);
  const ids = gatherTemplateIdsFromContainerData(dataObj);

  for (const id of ids) {
    resObj[id] = await getCachedProjectObj('template', id, holder.dm);
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

async function joinContainersForLayout(layoutId, holder) {
  const resObj = {};
  const dataObj = await getCachedProjectObj('layout', layoutId, holder.dm);
  const ids = gatherContainerIdsFromLayoutData(dataObj); // ids контейнеров

  for (const id of ids) {
    const data = await getCachedProjectObj('container', id, holder.dm); // Файл контейнера
    resObj[id] = data;
  }
  return resObj;
}

async function joinContainersRtForLayout(layoutId, holder) {
  let resObj = {};
  const dataObj = await getCachedProjectObj('layout', layoutId, holder.dm);

  const ids = gatherContainerIdsFromLayoutData(dataObj);

  for (const id of ids) {
    const oneCont = await getRtForContainerElements('container', { id }, holder);
    // const oneCont = await getRtForContainerElements('container', id, holder);
    // Нужно объединять по устройствам!!
    resObj = hut.merge(resObj, oneCont);
  }

  const vc_didMap = gatherContainersDevContextMapFromLayoutData(dataObj);
  for (const [key, did] of vc_didMap) {
    resObj[did] = getStaticObj(holder, did, '');
  }

  return resObj;
}

async function getFramesArrayForLayout(layoutId, dm) {
  const dataObj = await getCachedProjectObj('layout', layoutId, dm);

  return gatherFramesFromLayoutData(dataObj);
}

async function getFramesForLayout(layoutId, dm) {
  const dataObj = await getCachedProjectObj('layout', layoutId, dm);

  return gatherFramesFromLayoutData(dataObj);
}

/* Возвращает значения переменных для контейнера, диалога или экрана
 *
 */
async function getRtForContainerElements(id, query, holder) {
  const nodeid = query.id;
  const cObj = await getCachedUpProjectObj({ id, nodeid }, holder.dm);

  const res = {};
  const uppobj = cObj.data;

  for (const did of Object.keys(uppobj)) {
    if (did == '__template') {
      // Нужно получить данные по contextId
      const dids = await getDidsAndPropsFromLinksByContext(query);
      Object.keys(dids).forEach(visprop => {
        res[visprop] = getStaticObj(holder, dids[visprop].did, dids[visprop].prop);
      });
    } else {
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
    }
  }
  return res;
}

async function getDidsAndPropsFromLinksByContext(query) {
  const resObj = {};
  return resObj;
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
    (isGlobalVar(did) && holder.global.getItem(did) != undefined) || isLocalVar(did) || holder.devSet[did]
    // (holder.devSet[did] && holder.devSet[did][prop] != undefined)
  );
}

function getStaticObj(holder, did, prop) {
  if (!holder.devSet[did]) return {};
  const dobj = holder.devSet[did];

  // Получить placeArr и placeStr
  const placePath = domaindata.getDevicePlacePath(did, holder);
  // const placePath = datautil.getPathFromTree('devdevices', did, 'place');
  const placeArr = placePath.split('/');
  const res = { dn: dobj.dn, prop, name: dobj.name, sys: dobj.sys, placePath, placeArr };
  res.placeStr = placeArr.join(' ');

  const props = dobj.getPropsForVislink();
  if (props) {
    props.forEach(xprop => {
      res[xprop] = dobj.getPropValue(xprop);
    });
  }

  return res;
}

function getPropVal(holder, did, prop) {
  if (!did || !prop) return 0;

  if (isGlobalVar(did)) return holder.global.getValue(did) || 0;

  if (isLocalVar(did)) {
    // Отдать дефолтное значение
    return domaindata.getLocalDefval(did);
    // const item = domaindata.getListItem('localList', did);
    // return item ? item.defval : 0;
  }

  return holder.devSet[did] ? holder.devSet[did].getPropValue(prop) : '';
  // return holder.devSet[did][prop] || 0;
}

function gatherFramesFromLayoutData(dataObj) {
  const arr = [];

  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(name => {
      if (dataObj.elements[name].type && dataObj.elements[name].type == 'container') {
        const title = dataObj.elements[name]._label || dataObj.elements[name].title || name;
        arr.push({ id: name, title });
        // arr.push(name);
      }
    });
  }
  return arr;
}

function gatherContainerIdsFromLayoutData(dataObj) {
  const ids = [];

  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(name => {
      if (
        dataObj.elements[name].type &&
        dataObj.elements[name].type == 'container' &&
        dataObj.elements[name].widgetlinks &&
        dataObj.elements[name].widgetlinks.link &&
        dataObj.elements[name].widgetlinks.link.id
      ) {
        ids.push(dataObj.elements[name].widgetlinks.link.id);
      }
    });
  }
  return ids;
}

function gatherContainersDevContextMapFromLayoutData(dataObj) {
  const vc_contextDevice = new Map();

  if (dataObj && dataObj.elements) {
    Object.keys(dataObj.elements).forEach(name => {
      if (
        dataObj.elements[name].type &&
        dataObj.elements[name].type == 'container' &&
        dataObj.elements[name].widgetlinks &&
        dataObj.elements[name].widgetlinks.link &&
        dataObj.elements[name].widgetlinks.link.id &&
        dataObj.elements[name].widgetlinks.link.value &&
        dataObj.elements[name].widgetlinks.link.value.device &&
        dataObj.elements[name].widgetlinks.link.value.device.id
      ) {
        vc_contextDevice.set(name, dataObj.elements[name].widgetlinks.link.value.device.id);
      }
    });
  }
  return vc_contextDevice;
}

async function joinTemplatesForLayout(layoutId, holder) {
  const dataObj = await getCachedProjectObj('layout', layoutId, holder.dm);
  const cids = gatherContainerIdsFromLayoutData(dataObj);

  // Собрать из контейнеров id templates - могут быть повторения
  const tempSet = new Set();
  for (const id of cids) {
    const contData = await getCachedProjectObj('container', id, holder.dm);
    const tids = gatherTemplateIdsFromContainerData(contData);
    tids.forEach(tid => {
      tempSet.add(tid);
    });
  }

  const resObj = {};
  const ids = Array.from(tempSet);
  for (const id of ids) {
    resObj[id] = await getCachedProjectObj('template', id, holder.dm);
  }
  return resObj;
}

async function getCachedProjectObj(id, nodeid, dm) {
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
async function getCachedUpProjectObj({ id, nodeid }, dm) {
  return dm.getCachedData({ type: 'uppobj', id, nodeid, method: 'get' }, getUpPobj);
}

async function getElementLinks(id, nodeid, dm) {
  // Получить исходный объект
  const pobj = await getCachedProjectObj(id, nodeid, dm);
  if (!pobj || !pobj.elements) return [];

  const res = [];

  Object.keys(pobj.elements).forEach(el => {
    if (pobj.elements[el] != null && typeof pobj.elements[el] == 'object') {
      if (pobj.elements[el].widgetlinks) {
        if (pobj.elements[el].widgetlinks.link && pobj.elements[el].widgetlinks.link.did) {
          res.push({ element: el, did: pobj.elements[el].widgetlinks.link.did, prop: '' });
        }
      } else {
        Object.keys(pobj.elements[el]).forEach(visprop => {
          if (pobj.elements[el][visprop] != null && typeof pobj.elements[el][visprop] == 'object') {
            // Найти свойства с enabled
            if (pobj.elements[el][visprop].enabled) {
              const did = pobj.elements[el][visprop].did;
              const prop = pobj.elements[el][visprop].prop;
              res.push({ element: el + '.' + visprop, did, prop });
            } else if (visprop == 'actions') {
              if (pobj.elements[el][visprop].type == 'multi') {
                Object.keys(pobj.elements[el][visprop]).forEach(key => {
                  if (key.startsWith('action')) {
                    const item = pobj.elements[el][visprop][key];
                    if (item.left) processActionsArray(item.left, el);
                    if (item.right) processActionsArray(item.right, el);
                  }
                });
              } else {
                const item = pobj.elements[el][visprop];
                if (item.left) processActionsArray(item.left, el);
                if (item.right) processActionsArray(item.right, el);
              }
            }
          }
        });
      }
    }
  });
  return res;

  function processActionsArray(arr, el) {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (item && item.did) {
        res.push({ did: item.did, prop: item.prop, element: el + '.' + item.action });
      }
    });
  }
}

async function getUpPobj(query, dm) {
  const { id, nodeid } = query;
  const res = {};

  // Получить исходный объект
  const pobj = await getCachedProjectObj(id, nodeid, dm);
  if (!pobj || !pobj.elements) return {};

  // Вывернуть по did
  for (const el of Object.keys(pobj.elements)) {
    // Object.keys(pobj.elements).forEach(el => {
    if (pobj.elements[el] != null && typeof pobj.elements[el] == 'object') {
      Object.keys(pobj.elements[el]).forEach(visprop => {
        if (pobj.elements[el][visprop] != null && typeof pobj.elements[el][visprop] == 'object') {
          // Найти свойства с enabled
          if (pobj.elements[el][visprop].enabled) {
            const did = pobj.elements[el][visprop].did;
            const prop = pobj.elements[el][visprop].prop;
            if (pobj.elements[el][visprop].title && pobj.elements[el][visprop].title.startsWith('template.')) {
              // template:true для диалога - сохранить prop в элементе __template??
              // НЕТ title:'template.state'
              addToRes('__template', prop, { el });
            } else {
              addToRes(did, prop, { el });
            }
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

      if (isChart(pobj.elements[el], 'chart_multi')) {
        // pobj.elements[el].type == 'chart' &&
        // pobj.elements[el].realtime &&
        // pobj.elements[el].realtime.value &&
        // pobj.elements[el].widgetlinks

        const chartid = pobj.elements[el].widgetlinks.link.id;
        const chartData = await dm.findRecordById('chart', chartid);
        if (chartData && chartData.props) {
          Object.keys(chartData.props).forEach(prop => {
            const line = chartData.props[prop];
            if (line.dn_prop) {
              if (!res.charts) res.charts = {};
              if (!res.charts[line.dn_prop]) res.charts[line.dn_prop] = [];
              res.charts[line.dn_prop].push(chartid);
            }
          });
        }
      } else if (isChart(pobj.elements[el], 'chart')) {
        // график с одним значением - подписка на did_prop
        if (pobj.elements[el].widgetlinks.link && pobj.elements[el].widgetlinks.link.prop) {
          if (!res.charts) res.charts = {};
          const link = pobj.elements[el].widgetlinks.link;

          if (link.id == '__device' || !link.id) {
            // через контекст: widgetlinks.link.id = '__device' (или пусто?)
            if (!res.charts.__device) res.charts.__device = [];

            // М б несколько графиков в одном диалоге для разных свойств!!?
            res.charts.__device.push(link.prop);
          } else {
            // реальное значение: widgetlinks.link.id = did
            const did_prop = link.id + '.' + link.prop;
            if (!res.charts[did_prop]) res.charts[did_prop] = did_prop;
          }
        }
      } else if (isWidgetOfType(pobj.elements[el], 'devicelog')) {
        if (!res.devicelog) res.devicelog = {};
        res.devicelog[pobj.elements[el].widgetlinks.link.id] = el;
      } else if (isWidgetOfType(pobj.elements[el], 'alertlog')) {
        if (!res.alertlog) res.alertlog = {};
        // res.alertlog[pobj.elements[el].widgetlinks.link.id] = el;
        res.alertlog[pobj.elements[el].widgetlinks.link.id] = pobj.elements[el].widgetlinks.link.id;
      }
    }
  }
  // });
  return res;

  function isChart(elItem, type) {
    return elItem.type == type && elItem.realtime && elItem.realtime.value && elItem.widgetlinks;
  }

  function isWidgetOfType(elItem, type) {
    return elItem.type == type && elItem.widgetlinks && elItem.widgetlinks.link && elItem.widgetlinks.link.id;
  }

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
async function findTemplateUsageForContainer(templateId, containerId, dm) {
  const res = [];
  const dataObj = await getCachedProjectObj('container', containerId, dm);
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
  getElementLinks,
  findTemplateUsageForContainer,
  findRemovedVarsAndActionsForTemplate,
  removeVarsAndActionsFromContainer,
  gatherContainerIdsFromLayoutData,
  getFramesArrayForLayout,
  getFramesForLayout,
  isProp
};
