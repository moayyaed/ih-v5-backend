/**
 * Модуль для выполнения системных и служебных команд
 *
 *  throw если ошибка
 * @param {*} query
 * @param {*} holder
 */

async function exec(query, holder) {
  try {
    switch (query.command) {
      case 'restart':
        // Возможно перезагрузка с другим проектом
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
