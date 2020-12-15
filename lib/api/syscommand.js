/**
 * Cистемные и служебные команды
 *
 * */

const fs = require('fs');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

/**
 * Выполнить команду
 * @param {*} query
 * @param {*} holder
 *
 *  throw если ошибка
 */
async function exec(query, holder) {
  try {
    switch (query.command) {
      case 'restart':
        // Возможно перезагрузка с другим проектом
        if (query.param && query.nodeid) {
          // Записать в config имя нового проекта
          const folder = await getProjectFolderById(query.nodeid);
          console.log('INFO: Get command Restart with project '+folder);
          appconfig.saveConfigParam('project', folder);
        } else {
          console.log('INFO: Get command Restart');
        }
        deferredExit(holder);
        return;

      case 'plugincommand': 
      break;
        // throw {message:'plugincommand '+JSON.stringify(query)};


      default:
    }
  } catch (e) {
    throw { message: 'Command ' + query.command + ' failed!  ' + JSON.stringify(e) };
  }

  function deferredExit(houser, command) {
    // holder.emit('finish');
    setTimeout(() => {
      if (!command) {
        // Сохраниться?
        process.exit();
      } else {
        // TODO  reboot || shutdown - нужно вызвать системную команду
      }
    }, 2000);
  }
}

async function getProjectFolderById(_id) {
  console.log('WARN: getProjectFolderById '+_id)
  try {
    const doc = await dm.dbstore.findOne('projects', { _id });
    if (!doc) throw { message: 'Project not found: id=' + _id };
    const project = doc.projectfolder;
    if (!project) throw { message: 'Invalid record: missing projectfolder!' };

    // Проверить, что папка существует
    const folder = appconfig.getTheProjectPath(project);

    if (!fs.existsSync(folder)) throw { message: 'Project not found:'+folder };

    // if (!appconfig.isProjectPath(folder)) throw { message: 'Missing or invalid or empty project: ' + folder };

    return project;
  } catch (e) {
    throw { message: e.message };
  }
}

module.exports = {
  exec
};
