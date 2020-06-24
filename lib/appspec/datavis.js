/**
 * datavis.js
 * Обработка файлов layout, template, container
 * 
 */

const dataformer = require('../api/dataformer');

async function getDataVis(cmd, query, holder) {
  switch (cmd) {
    case 'layout':
    case 'container':
    case 'template':
      return dataformer.getCachedProjectObj(cmd, query.id);

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
  const dataObj = await dataformer.getCachedProjectObj('container', containerId);
  const ids = gatherTemplateIdsFromContainerData(dataObj);

  for (const id of ids) {
    resObj[id] = await dataformer.getCachedProjectObj('template', id);
  }
  return resObj;
}

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
  const dataObj = await dataformer.getCachedProjectObj('layout', layoutId);
  const ids = gatherContainerIdsFromLayoutData(dataObj);
  for (const id of ids) {
    const data = await dataformer.getCachedProjectObj('container', id); // Файл контейнера
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
  const dataObj = await dataformer.getCachedProjectObj('layout', layoutId);
  const cids = gatherContainerIdsFromLayoutData(dataObj);

  // Собрать из контейнеров id templates - могут быть повторения
  const tempSet = new Set();
  for (const id of cids) {
    const contData = await dataformer.getCachedProjectObj('container', id);
    const tids = gatherTemplateIdsFromContainerData(contData);
    tids.forEach(tid => {
      tempSet.add(tid);
    });
  }

  const resObj = {};
  const ids = Array.from(tempSet);
  for (const id of ids) {
    resObj[id] = await dataformer.getCachedProjectObj('template', id);
  }
  return resObj;
}


module.exports = {
  getDataVis
}