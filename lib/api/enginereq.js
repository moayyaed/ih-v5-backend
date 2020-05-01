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
  if (!query.id) throw { message: 'Expected id in query: ' + query };
  const cmd = pathArr[0];

  switch (cmd) {
    case 'startscene':
      // Проверить, что существует сценарий?? И он не запущен??
      holder.emit('startscene', req.query);
      break;

    case 'layout':
    case 'container':
    case 'template':
      dataObj = await dataformer.getCachedProjectObj(cmd, query.id);
      break;

    default:
      throw { message: '!??Missing or invalid command: ' + cmd };
  }

  return { data: dataObj };
};
