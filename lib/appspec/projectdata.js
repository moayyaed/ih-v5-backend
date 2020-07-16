/**
 * projectdata.js
 * Обработка файлов проекта
 * 
 * 
 */

// const dataformer = require('../api/dataformer');
const dm = require('../datamanager');
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
      if (
        dataObj.elements[elName].type == 'template' &&
        dataObj.elements[elName].templateId == templateId
      ) {
        res.push(elName);
      }
    });
  }
  return res;
}


async function getDataVis(cmd, query, holder) {
  switch (cmd) {
    case 'layout':
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
      throw {err:'SOFTERR', message: "Expected 'containerid' or 'layoutid' in query!" };
    

    case 'containers':
      // Все контейнеры для экрана
      if (query.layoutid) {
        return joinContainersForLayout(query.layoutid, query.rt, holder);
      }
      throw {err:'SOFTERR', message: "Expected 'layoutid' in query!" };
      
    default:
      throw {err:'SOFTERR', message: "Unknown command in query: "+cmd };
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
      if (data.elements[el].type == 'template') {
        const states = {};
        if (typeof data.elements[el].links == 'object') {
          Object.keys(data.elements[el].links).forEach(name => {
            const { did, prop } = data.elements[el].links[name];
            states[name] = holder.devSet[did] ? holder.devSet[did][prop] : 0; // Значение получить из holder по did, prop
          });
        }
        res[el] = { states };
      }
    });
  }
  return res;
}

function gatherContainerIdsFromLayoutData(dataObj) {
  const ids = [];

  /*
  if (dataObj && dataObj.columns) {
    Object.keys(dataObj.columns).forEach(colName => {
      if (
        dataObj.columns[colName].type &&
        dataObj.columns[colName].type == 'container' &&
        dataObj.columns[colName].containerId &&
        dataObj.columns[colName].containerId.id
      ) {
        ids.push(dataObj.columns[colName].containerId.id);
      }
    });
  }
  */
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

    if (pobj.elements[el].type == 'template' && pobj.elements[el].links && typeof pobj.elements[el].links == 'object') {

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
  });
  return res;
}

module.exports = {
  getDataVis,
  getCachedProjectObj,
  getCachedUpProjectObj,
  findTemplateUsageForContainer
}