/**
 *  enginereq.js
 */

// const util = require('util');
const dataformer = require('./dataformer');

// Обработчик запросов /api/engine, обрабатываемых движками (сценариев, устройств, ...) через holder
// /api/engine/xx?id=yy

module.exports = async function(pathArr, req, holder) {
  let dataObj = '';
  const query = req.query;
  // if (!query.id) throw { message: 'Expected id in query: ' + query };

  const cmd = pathArr[0];

  switch (cmd) {
    case 'startscene':
      // Проверить, что существует сценарий?? И он не запущен??
      holder.emit('start:scene', req.query);
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
        // dataObj = await dataformer.getCachedProjectObj(cmd, query.id);
        dataObj = await joinTemplatesFromContainer(query.id);
      }

      break;
    default:
      throw { message: '!??Missing or invalid command: ' + cmd };
  }

  return { data: dataObj };
};

async function joinTemplatesFromContainer(containerId) {
  const resObj = {};
  const dataObj = await dataformer.getCachedProjectObj('container', containerId);
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
  for (const id of ids) {
    resObj[id] = await dataformer.getCachedProjectObj('template', id);
  }
  return resObj;
}
