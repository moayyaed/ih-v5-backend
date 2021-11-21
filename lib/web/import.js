/**
 * import.js
 *
 * Middleware for POST /import
 *
 * Загрузка пакетов .ihpack, .zip (не в дереве)
 *
 * После распаковки отправляются сообщения о процессе через watch
 *  (на фронте диалоговое окно подписывается по uuid)
 */
const util = require('util');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const auth = require('./auth');

const importutil = require('../utils/importutil');
const importPack = require('../utils/importPack');

module.exports = function(holder) {
  return async (req, res) => {
    const body = req.body;
    const watchid = body.watch && body.uuid ? body.uuid : 'xxx';

    let tempFolder;
    let toDelete;
    const token = req.headers.token;
    try {
      await checkAccess(token);
      const files = importutil.getReqFiles(req);

      const xres = await importutil.extractFromZip(files[0]);
      if (!xres.xfolder) throw { message: 'Empty zip archive!' };
      tempFolder = xres.xfolder;
      toDelete = xres.toDelete;

      // После загрузки - отправляем ответ
      await hut.sleepMs(1200);
      res.send(JSON.stringify({ response: 1 }));
    } catch (err) {
      const errMsg = err && err.message ? err.message : util.inspect(err);
      console.log('ERROR: import ' + errMsg);
      res.status(400).end('Error: ' + hut.getShortErrStr(errMsg)); // Bad request - invalid syntax
      emitWatch(errMsg, 'error');
    }

    // Дальше сообщения о процессе идут через watch
    try {
      await importPack(tempFolder, watchid, holder);
      emitWatch('', 'complete');
    } catch (err) {
      const message = (err && err.message) || util.inspect(err);
      console.log('ERROR: import ' + message);
      emitWatch(message, 'error');
    }
    // Здесь можно сразу отписывать watchid, т к он завершен?
    // Удалить временную папку
    importutil.deleteIfNeed(toDelete);

    function emitWatch(message, status) {
      if (watchid && holder) {
        holder.emit('watch', { uuid: watchid, message, status });
      }
    }
  };
};

async function checkAccess(token) {
  const user = await auth.getUserByToken(token);
  if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };
}
