/**
 * Cистемные и служебные команды
 *
 * */

// const util = require('util');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');
const dbagentutil = require('../dbs/dbagentutil');

const checkUpdateSystem = require('../sysupdate/checkUpdateSystem');
const updateSystem = require('../sysupdate/updateSystem');
const licutil = require('../domain/licutil');

/**
 * Выполнить команду с кнопки
 * @param {*} query
 * @param {*} holder
 *
 *  throw если ошибка
 */
async function exec(query, holder) {
  let res;

  try {
    switch (query.command) {
      case 'restart':
        // Возможно перезагрузка с другим проектом или dbagent
        await beforeRestartWith();
        /*
        if (query.param) {
          await beforeRestartWith();
        } else {
          console.log('INFO: Get command Restart');
        }
        */
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

      case 'activate':
        return licutil.activateLicense(query, holder);

      case 'deactivate':
        return licutil.deactivateLicense(query, holder);

      case 'deactivate_demo':
        return licutil.deactivateDemoLicense(query, holder);

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

  async function beforeRestartWith() {
    const { param, nodeid } = query;
    if (!nodeid) throw { message: 'Not defined nodeid for ' + param };
    if (param == 'project') {
      let project = nodeid;
      const newproject = await saveProjectSettingsIfChanged(project);
      if (newproject) project = newproject;

      // Записать в config имя (папку) проекта, на который переключаемся
      appconfig.saveConfigParam('project', project);
      console.log('INFO: Get command Restart with project ' + project);
      return;
    }

    if (param == 'dbagent') {
      console.log('INFO: Get command Restart with dbagent ' + nodeid);
      return dbagentutil.replaceActiveDbagent(nodeid, holder);
    }

    if (param == 'settings') {
      // Перезагрузка с новыми config настройками
      await saveConfig(query.payload);
    }
  }

  async function saveProjectSettingsIfChanged(project) {
    // Могли изменить имя и папку проекта - тогда перезаписать
    const props = getChangesFromPayload(query.payload);
    if (!props) return; // не передано с интерфейса - ничего не изменилось

    // Сравнить с текущим значением из таблицы
    // throw перехватывается на верхнем уровне
    const toUpdate = await holder.dm.checkFieldsWithRecord('project', project, props);
    if (!toUpdate) return;

    // Если нужно переименовать папку - это сделать в последнюю очередь
    // Остальные изменения записать в project.json
    const { projectfolder, ...otherProps } = toUpdate;

    // Имя папки проекта - пусть будет простое!!
    if (projectfolder && !hut.isIdValid(projectfolder))
      throw { message: appconfig.getMessage('IllegalProjectFolderName') };

    if (otherProps) {
      appconfig.saveTheProjectProps(project, otherProps);
    }

    if (projectfolder) {
      // нужно переименовать папку проекта.
      const from = appconfig.getTheProjectPath(project);
      const to = appconfig.getTheProjectPath(projectfolder);
      if (!fs.existsSync(from)) throw { message: appconfig.getMessage('SRCFOLDERNOTEXISTS') };
      if (fs.existsSync(to)) throw { message: appconfig.getMessage('FOLDERALREADYEXISTS') };
      await fs.promises.rename(from, to);

      project = projectfolder;
    }

    return project;
  }

  function getChangesFromPayload(payload) {
    return !payload || !payload.p1 ? '' : { projectfolder: payload.p1.projectfolder, title: payload.p1.title };
  }

  async function saveConfig(payload) {
    const newObj = {};
    if (!payload || !payload.p1 || !payload.p2) throw { message: 'Expected payload.p1 and payload.p2!' };
    const rec = { ...payload.p1, ...payload.p2 };

    if (rec.port) newObj.port = rec.port;
    if (rec.apiport) newObj.apiport = rec.apiport;
    if (rec.lang) {
      const lang = typeof rec.lang == 'object' ? rec.lang.id : rec.lang;
      newObj.lang = lang;
    }
    if (rec.expert != undefined) newObj.expert = rec.expert;

    if (rec.otherprojdir != undefined) {
      // Переключили галочку
      if (!rec.otherprojdir) {
        // Восстановить default
        newObj.projdir = '';
      } else {
        if (!rec.projdir) throw { message: 'Не указан другой путь для проектов!' };
        newObj.projdir = rec.projdir;
      }
    }

    // Если изменился  projdir - сбросить проект, иначе он создается пустой с этим именем
    if (appconfig.get('projdir') != newObj.projdir) {
      newObj.project = '';
    }
    console.log('INFO: Get command Restart with new settings:  ' + JSON.stringify(newObj));
    appconfig.saveConfigObject(newObj);
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
}

module.exports = {
  exec
};
