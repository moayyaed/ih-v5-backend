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
  
      conf: appconfig.getConf(),
      header: appconfig.getConfTitle(),
      title: appconfig.getConfInfoMessage(),
      version: appconfig.get('version'),
      uptimeSec:Math.floor(process.uptime())
    };

    const result = Object.assign({ response: 1 }, dataObj);
    res.send(JSON.stringify(result));
  };
};
