/**
 * Cистемные и служебные команды
 *
 * */

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
          // appconfig.saveConfigParam
        }
        deferredExit(holder);
        return;

      default:
    }
  } catch (e) {
    throw { message: 'Command ' + query.command + ' failed!' + e.message };
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

module.exports = {
  exec
};
