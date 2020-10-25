/**
 * Cистемные и служебные команды
 *
 * */

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

      default:
    }
  } catch (e) {
    throw { message: 'Command ' + query.command + ' failed!  ' + e.message };
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
  try {
    const doc = await dm.dbstore.findOne('projects', { _id });
    if (!doc) throw { message: 'Project not found: id=' + _id };
    const project = doc.projectfolder;
    if (!project) throw { message: 'Invalid record: missing projectfolder!' };

    // Проверить, что папка существует
    let folder = appconfig.getTheProjectPath(project);

    if (!appconfig.isProjectPath(folder)) throw { error: 'Missing or invalid or empty project: ' + folder };

    return project;
  } catch (e) {
    throw { message: e.message };
  }
}

module.exports = {
  exec
};