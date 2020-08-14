/**
 *
 */

const util = require('util');
const datautil = require('../api/datautil');

/**  Обработка запроса "type":"command" или "type":"devicecommand"
 * Для устройства 2 варианта:
 * {"method":"action", "type":"command", "command":"device",  "did":"d003", "prop":"on", "uuid":"xyzjjk"}
 * ИЛИ
 * {"method":"action", "type":"devicecommand", "id":"d003", "command":"on", "uuid":"xyzjjk"}
 *
 * Остальные запросы:
 * {"method":"action", "type":"command", "command":"layout", "id":"l003",  "value":{param1, param2,..},"uuid":"xyzjjk"}
 * {"method":"action", "type":"command", "command":"plugin", "id":"modbus1", "value":{param1, param2,..},  "uuid":"xyzjjk"}
 * {"method":"action", "type":"command", "command":"script", "id":"scen003", "value":{param1, param2,..},  "uuid":"xyzjjk"}
 *
 */
function execCommand(clid, mes, holder) {
  if (!mes.command) return { err: 'Missing command!' };

  let res = { err: '' };
  switch (mes.command) {
    case 'device':
      // {"method":"action", "type":"command", "command":"device",  "did":"d003", "prop":"on", "uuid":"xyzjjk"}
      if (mes.did && mes.prop) {
        res = execDeviceCommand(clid, { did: mes.did, prop: mes.prop });
      } else {
        res.err = 'Expected did and prop for command:device!';
      }
      break;

    case 'layout':
      // отправить команду клиенту назад - на переключение экрана
      // TODO - проверить, что права есть

      // Проверить, что экран существует
      if (datautil.existsListItem('layoutList', mes.id)) {
        res.toSend = { method: 'servercommand', command: 'gotolayout', id: mes.id };
      } else {
        res.err = 'Запрашиваемый экран ' + mes.id + ' не существует!';
      }
      break;

    case 'plugin':
      // отправить команду плагину
      // TODO - проверить, что права есть
      holder.emit('pluginCommand', mes);
      break;

    case 'script':
      // запуск скрипта
      // TODO - проверить, что права есть
      // TODO - sender взять из clid
      // Проверить что сценарий существует и не запущен
      if (!holder.sceneSet[mes.id]) {
        res.err = 'Сценарий не существует: ' + mes.id;
      } else if (!holder.sceneSet[mes.id].isReady()) {
        res.err = 'Сценарий уже запущен или заблокирован';
      } else {
        holder.emit('startscene', { id: mes.id, arg: mes.value, sender: 'login:admin' });
      }
      break;

    default:
      res.err = 'Unexpected command ' + mes.command;
  }
  return res;
}

function execDeviceCommand(clid, { did, prop }, holder) {
  const dobj = holder.devSet[did];
  const res = { err: '' };
  if (!dobj) {
    res.err = 'Not found device with id: ' + did;
  } else if (prop) {
    if (!dobj.hasCommand(prop)) {
      res.err = 'No command "' + prop + '" for device: ' + dobj.dn + '  (' + dobj.name + ')';
    } else {
      dobj.doCommand(prop, { src: 'login:admin' }); // TODO - взять из clid
    }
  } else {
    res.err = 'Missing command!';
  }
  return res;
}

module.exports = {
  execCommand,
  execDeviceCommand
};
