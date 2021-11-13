/**
 *  enginereq.js
 */

// const util = require('util');

const projectdata = require('../domain/projectdata');
const commander = require('../domain/commander');
const widgetdata = require('../domain/widgetdata');

const getapi = require('./getapi');

// Обработчик запросов /api/engine, обрабатываемых движками (сценариев, устройств, ...) через holder
// /api/engine/xx?id=yy

module.exports = async function(pathArr, req, user, holder) {
  let dataObj = '';
  const query = req.query;
  // if (!query.id) throw { message: 'Expected id in query: ' + query };

  const cmd = pathArr[0];

  switch (cmd) {
    case 'get':
      // /api/engine/get?type=dict&id=locals
      query.method = 'get';
      return getapi.get(query, user, holder);

    case 'action':
      // Выполнить команду устройства или set свойства
      if (query.command == 'setval') {
        // /api/engine/action?command=setval&did=d0802&prop=auto&value=0
        return commander.execSet(user, query, holder);
      }
      execDeviceAction(query, holder);

      break;

    case 'startscene':
      // Проверить, что существует сценарий?? И он не запущен??
      holder.emit('startscene', query);
      break;

    case 'startplugin':
    case 'stopplugin':
      // Проверить, что существует плагин?
      if (!holder.unitSet[query.id]) throw { message: 'Missing plugin ' + query.id };
      holder.emit(cmd == 'startplugin' ? 'start:plugin' : 'stop:plugin', query.id);
      break;

    case 'layout':
      // console.log('USER='+util.inspect(user))
      if (!holder.am.isLayoutAvailable(query.id, user._id)) throw { message: 'Доступ запрещен!' };
      dataObj = query.widgetdata
      ? await widgetdata.getWidgetdata(cmd, query, holder)
      : await projectdata.getDataVis(cmd, query, holder);
      break;

    case 'container':
    case 'template':
    case 'dialog':
    case 'templates':
    case 'containers':
      dataObj = query.widgetdata
        ? await widgetdata.getWidgetdata(cmd, query, holder)
        : await projectdata.getDataVis(cmd, query, holder);
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
  const did = dobj._id;

  if (query.command) {
    if (!dobj.hasCommand(query.command))
      throw {
        err: 'ERR',
        message: 'No command "' + query.command + '" for device: ' + dobj.dn + '  (' + dobj.name + ')'
      };
    // dobj[query.command]();
    commander.execDeviceCommand(null, { did, prop: query.command }, holder) 
    return;
  }

  if (!dobj.hasProp(query.prop))
    throw { err: 'ERR', message: 'No prop "' + query.prop + '" for device: ' + dobj.dn + '(id=' + dobj._id + ')' };
  // dobj.setValue(query.prop, query.set);
  commander.execSet(null, {did, prop: query.pro, value: query.set}, holder);
}
