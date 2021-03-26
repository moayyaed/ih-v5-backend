/**
 * Cистемные и служебные команды
 *
 * */

// const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const dbagentutil = require('../dbs/dbagentutil');

const checkUpdateSystem = require('../sysupdate/checkUpdateSystem');
const updateSystem = require('../sysupdate/updateSystem');

/**
 * Выполнить команду с кнопки
 * @param {*} query
 * @param {*} holder
 *
 *  throw если ошибка
 */
async function exec(query, holder) {
  const dm = holder.dm;
  let res;

  try {
    switch (query.command) {
      case 'restart':
        // Возможно перезагрузка с другим проектом или dbagent
        if (query.param) {
          await beforeRestartWith(query.param, query.nodeid);
        } else {
          console.log('INFO: Get command Restart');
        }
        deferredExit(holder);
        return;

      case 'checkupdate':
        return checkUpdateSystem();

      case 'portallogout':
        // удалить информацию о регистрации
        appconfig.setRegistry({});
        return { refresh: 1 };

      case 'update':
        res = await updateSystem();
        if (res.ok) {
          deferredExit(holder);
        }
        return res;

      case 'writetochannel':
        holder.emit('send:device:command', await fromWriteObj(query));
        return { alert: 'info', message: 'Команда отправлена плагину', mes: 'OK', mess: 'OK!' };

      default:
        throw { message: 'Unknown command  ' + query.command + ' IN ' + JSON.stringify(query) };
    }
  } catch (e) {
    // throw { message: 'Command ' + query.command + ' failed!  ' + JSON.stringify(e) };
    throw e;
  }

  async function beforeRestartWith(param, nodeid) {
    if (!query.nodeid) throw { message: 'Not defined ' + param };
    if (param == 'project') {
      // Записать в config имя нового проекта
      const folder = await getProjectFolderById(nodeid);
      console.log('INFO: Get command Restart with project ' + folder);
      appconfig.saveConfigParam('project', folder);
      return;
    }

    if (param == 'dbagent') {
      console.log('INFO: Get command Restart with dbagent ' + nodeid);
      return dbagentutil.replaceActiveDbagent(nodeid, holder);
    }
  }

  async function fromWriteObj() {
    if (!query.nodeid) throw { message: 'Expected nodeid for command:"writetochannel" ' };
    if (!query.subnodeid) throw { message: 'Expected subnodeid for command:"writetochannel" ' };
    // nodeid:'mqttclient1' = unit
    // subnideid - id в devhard
    const doc = await holder.dm.findRecordById('devhard', query.subnodeid);
    if (!doc) throw { message: 'Not found record with id=' + query.subnodeid + ' for command:"writetochannel" ' };
    if (!doc.chan)
      throw { message: 'No channel in record with id=' + query.subnodeid + ' for command:"writetochannel" ' };
    return { unit: query.nodeid, chan: doc.chan };
  }

  function deferredExit(houser, command) {
    // holder.emit('finish');
    setTimeout(() => {
      holder.emit('restart');
      if (!command) {
        // Сохраниться?
        process.exit();
      } else {
        // TODO  reboot || shutdown - нужно вызвать системную команду
      }
    }, 1000);
  }


async function getProjectFolderById(_id) {
  try {
    const doc = await dm.dbstore.findOne('projects', { _id });
    if (!doc) throw { message: 'Project not found: id=' + _id };
    const project = doc.projectfolder;
    if (!project) throw { message: 'Invalid record: missing projectfolder!' };

    // Проверить, что папка существует
    const folder = appconfig.getTheProjectPath(project);

    if (!fs.existsSync(folder)) throw { message: 'Project not found:' + folder };

    return project;
  } catch (e) {
    throw { message: e.message };
  }
}
}

module.exports = {
  exec
};
