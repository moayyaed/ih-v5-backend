/**
 *  enginereq.js
 */

// const util = require('util');
// const dataformer = require('./dataformer');

const datavis = require('../appspec/datavis');

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
    case 'templates':
    case 'containers':
      dataObj = await datavis.getDataVis(cmd, query, holder);
      break;

    default:
      throw { message: '!??Missing or invalid command: ' + cmd };
  }

  return dataObj ? { data: dataObj } : '';
};

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
