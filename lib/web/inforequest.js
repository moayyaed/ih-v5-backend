/**
 * Запрос на информацию о системе. Авторизации не требует
 */

const appconfig = require('../appconfig');

module.exports = function(holder) {
  return async (req, res, next) => {
    // /info Уже обрезано Ничего не проверяем

    res.setHeader('Content-Type', 'application/json');
    const dataObj = {
      name_service: appconfig.get('name_service'),
      lang: appconfig.get('lang'),
      header: 'IntraHouse',
      conf: 0,
      title: 'Не для коммерческого использования',
      version: appconfig.get('version'),
      uptimeSec:Math.floor(process.uptime())
    };
    const result = Object.assign({ response: 1 }, dataObj);
    res.send(JSON.stringify(result));
  };
};
