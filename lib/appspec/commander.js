/**
 *
 */

const util = require('util');
const datautil = require('../api/datautil');
const apicommand = require('../api/apicommand');
const servercommands = require('./servercommands');

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
async function execCommand(sender, mes, holder) {
  if (!mes.command) return { err: 'Missing command!' };

  let res = { err: '' };
  switch (mes.command) {
    // {type:'command', method:'row_command', command:'api_ack_alert', id:<alert id >}
    case 'api_ack_alert':
    case 'api_deack_alert':
      // Из sender-а нужно вытащить userId и добавить к mes??
      res = await apicommand.exec(mes, holder);
      break;

    case 'setval':
      if (mes.did && mes.prop) {
        res = execSet(sender, { did: mes.did, prop: mes.prop, value: mes.value }, holder);
      } else {
        res.err = 'Expected did and prop for command:setval!';
      }
      break;

    case 'device':
      // {"method":"action", "type":"command", "command":"device",  "did":"d003", "prop":"on", "uuid":"xyzjjk"}
      if (mes.did && mes.prop) {
        res = execDeviceCommand(sender, { did: mes.did, prop: mes.prop }, holder);
      } else {
        res.err = 'Expected did and prop for command:device!';
      }
      break;

    /*
    case 'visscript':
      if (!mes.id) return { err: 'Missing id of visscript!'};
      // Запустить скрипт визуализации (пока в этом потоке)
      // Передать ему параметры
      // Результат должен пойти самотеком из скрипта - отправить команду 'gotolayout'

      break;
      */

    case 'layout':
      // отправить команду клиенту назад - на переключение экрана
      // TODO - проверить, что права есть

      // Проверить, что экран существует
      if (datautil.existsListItem('layoutList', mes.id)) {
       
        let frames;
        if (mes.targetFrameTable && Array.isArray(mes.targetFrameTable)) {
          frames = mes.targetFrameTable;
        }
        const resObj = servercommands.gotoLayout(mes.id, frames);
        if (resObj || typeof resObj == 'object') {
          res.toSend = resObj;
        } else {
          console.log('ERROR: execCommand.gotoLayout, message: ' +  util.inspect(mes) + ' error: ' + resObj);
          res.err = 'Ошибка команды "gotoLayout" для ' + mes.id;
        }
      } else {
        res.err = 'Запрашиваемый экран ' + mes.id + ' не существует!';
      }
      break;

    case 'dialog':
      // отправить команду клиенту назад
      // TODO - проверить, что права есть

      if (datautil.existsListItem('dialogList', mes.id)) {
        // Формировать contextId
        let contextId = mes.contextId;
        res.toSend = { method: 'servercommand', command: 'showdialog', id: mes.id, contextId };
      } else {
        res.err = 'Диалог ' + mes.id + ' не существует!';
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
      if (!holder.worksceneSet[mes.id]) {
        res.err = 'Сценарий не существует: ' + mes.id;
      } else if (!holder.worksceneSet[mes.id].isReady()) {
        res.err = 'Сценарий уже запущен или заблокирован';
      } else {
        const arg = mes.param || mes.value;
        // holder.emit('start:scene', { id: mes.id, arg, sender: 'login:admin' });
        holder.deviceWorker.postMessage({ name: 'start:scene', data: { id: mes.id, arg, sender: 'login:admin' } });
      }
      break;

    default:
      res.err = 'Unexpected command ' + mes.command;
  }
  return res;
}

function execDeviceCommand(sender, { did, prop }, holder) {
  const dobj = holder.devSet[did];
  const res = { err: '' };
  try {
    if (!dobj) {
      res.err = 'Not found device with id: ' + did;
    } else if (prop) {
      if (!dobj.hasCommand(prop)) {
        res.err = 'No command "' + prop + '" for device: ' + dobj.dn + '  (' + dobj.name + ')';
      } else {
        // dobj.doCommand(prop, { src: 'login:admin' }); // TODO - взять из clid
        holder.deviceWorker.postMessage({ name: 'exec:device:command', data: { did, prop, sender } });
      }
    } else {
      res.err = 'Missing command!';
    }
  } catch (e) {
    console.log('ERROR: execDeviceCommand ' + did + ' ' + prop + util.inspect(e));
  }

  return res;
}

/**  Обработка запроса "type":"set"
 * Для установки значений свойств устройства или глобальной переменной
 * {"did":"d003", "prop":"auto", "value":1}
 *
 *  @return {err:''}
 */
function execSet(sender, mes, holder) {
  if (!mes.did) return { err: 'Missing did!' };
  if (mes.value == undefined) return { err: 'Missing value!' };

  const res = { err: '' };
  const did = mes.did;

  if (did.startsWith('local')) {
    return res;
  }

  if (did.startsWith('gl')) {
    if (!holder.global.getItem(did)) return { err: 'Not found globals ' + did };

    // holder.global.setValue(did, mes.value, { src: 'login:admin' });
    holder.deviceWorker.postMessage({ name: 'exec:global:setvalue', data: mes });
  } else {
    const dobj = holder.devSet[did];
    if (!dobj) return { err: 'Not found device with id: ' + did };
    if (!mes.prop) return { err: 'Missing prop!' };

    const prop = mes.prop;
    if (!dobj.isWritable(prop)) return { err: 'Property "' + prop + '" is not writable!' };

    // dobj.setValue(prop, mes.value, { src: 'login:admin' });
    holder.deviceWorker.postMessage({ name: 'exec:device:setvalue', data: { ...mes, sender } });
  }
  return res;
}

module.exports = {
  execCommand,
  execSet,
  execDeviceCommand
};
