/**
 * 
 */

const util = require('util');
const dataformer = require('../api/dataformer')

// Обработчик запросов /api/engine, обрабатываемых движками (сценариев, устройств, ...) через holder
// /api/engine/xx?id=yy
// Здесь нужна проверка доступа!!?

  module.exports = function (holder) {
    // return (req, res, next) => {
    return async (req, res) => {
      res.setHeader('Content-Type', 'application/json');

      try {
        // const url = req.url;  // Уже обрезано /api/engine!! = /startscene?id=1
        const cmd = req.url
          .split('/')
          .pop()
          .split('?')
          .shift();
        let dataObj = '';
        const query = req.query;
        if (!query.id) throw { message: 'Expected id in query: ' + query };

        switch (cmd) {
          case 'startscene':
           
            // Проверить, что существует сценарий?? И он не запущен??
            holder.emit('startscene', req.query);
            break;

          case 'layout':
          case 'container':
          case 'template':
            // dataObj = loadsys.loadProjectJsonSync(cmd, query.id);
            // dataObj = await loadsys.loadProjectJson(cmd, query.id);
            dataObj = await dataformer.getCachedProjectObj(cmd, query.id);
            break;
          default:
            throw { message: '!??Missing or invalid command: ' + cmd };
        }
       
        const result = { response: 1 , data:dataObj};
        res.send(JSON.stringify(result));
      } catch (e) {
        console.log('CATCH error' + util.inspect(e));
        res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
      }
    };
  }