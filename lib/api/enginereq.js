/**
 *  enginereq.js
 */

const util = require('util');
const dataformer = require('./dataformer');

// Обработчик запросов /api/engine, обрабатываемых движками (сценариев, устройств, ...) через holder
// /api/engine/xx?id=yy

module.exports = async function(pathArr, req, holder) {
  let dataObj = '';
  const query = req.query;
  // if (!query.id) throw { message: 'Expected id in query: ' + query };

  const cmd = pathArr[0];

  switch (cmd) {
    case 'action':
      // Выполнить команду устройства или set свойства
      execDeviceAction(query, holder);
      break;

    case 'startscene':
      // Проверить, что существует сценарий?? И он не запущен??
      holder.emit('start:scene', query);
      break;

    case 'startplugin':
    case 'stopplugin':
      // Проверить, что существует плагин?
      if (!holder.unitSet[query.id]) throw { message: 'Missing plugin ' + query.id };
      holder.emit(cmd == 'startplugin' ? 'start:plugin' : 'stop:plugin', query.id);
      break;

    case 'layout':
    case 'container':
    case 'template':
      dataObj = await dataformer.getCachedProjectObj(cmd, query.id);
      break;

    case 'templates':
      if (query.containerid) {
        // Все темплэйты для контейнера
        dataObj = await joinTemplatesForContainer(query.containerid);
      } else if (query.layoutid) {
        // Все темплэйты контейнеров для экрана
        dataObj = await joinTemplatesForLayout(query.layoutid);
      }
      break;

    case 'containers':
      // Все контейнеры для экрана 
      if (query.layoutid) {
        dataObj = await joinContainersForLayout(query.layoutid, query.rt, holder);
      }
      break;
      

    default:
      throw { message: '!??Missing or invalid command: ' + cmd };
  }

  return dataObj ? { data: dataObj } : '';
};

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
    // resObj[id] = await dataformer.getCachedProjectObj('container', id);
    const data  = await dataformer.getCachedProjectObj('container', id); // Файл контейнера
    resObj[id] = rt ? getRtForContainerElements(data, holder): data;
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
            states[name] = 1; // Значение получить из holder
          });
        }
        res[el] = {states};
      }
    });
  }
  return res;
}



function gatherContainerIdsFromLayoutData(dataObj) {
  const ids = [];
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
    tids.forEach(tid=> {tempSet.add(tid)});
  }

  const resObj = {};
  const ids = Array.from(tempSet);
  for (const id of ids) {
    resObj[id] = await dataformer.getCachedProjectObj('template', id);
  }
  return resObj;
}

function execDeviceAction(query, holder) {
  // Выполнить команду устройства или set свойства
  // {command:'on',id:'d001} | {command:'off',dn:'Lamp1'} | {dn:'DIM1', prop:'setpoint', set:42 }
  if (!query.id && !query.dn) throw { err: 'ERR', message: 'Expected "dn" or "id" of device!' };
  if (!query.command && !query.set) throw { err: 'ERR', message: 'Expected "command" or "set" in action!' };
  if (query.set && !query.prop) throw { err: 'ERR', message: 'Expected "prop" for "set" in action!' };

  const dobj = query.id ? holder.devSet[query.id] : holder.dnSet[query.dn];
  if (!dobj) throw { err: 'ERR', message: 'Device not found!' };

  if (query.command) {
    if (!dobj.hasCommand(query.command))
      throw {
        err: 'ERR',
        message: 'No command "' + query.command + '" for device: ' + dobj.dn + '  (' + dobj.name + ')'
      };
    dobj[query.command]();
    return;
  }

  if (!dobj.hasProp(query.prop))
    throw { err: 'ERR', message: 'No prop "' + query.prop + '" for device: ' + dobj.dn + '(id=' + dobj._id + ')' };
  dobj.set(query.prop, query.set);
}
