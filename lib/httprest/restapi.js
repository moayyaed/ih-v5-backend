/**
 * REST API handle
 */

const util = require('util');
const url = require('url');
const fs = require('fs');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

module.exports = function(holder) {
  return async (req, res, next) => {
   
    const method = req.method;
    const post =  method == 'POST';
    const err = await tryRunHandler(post);
    if (err) {
      // res.status(400).end('Error: ' + err); // 400 - Bad Request
      res.status(400).json({ res: 0, message: err });
    }

    async function tryRunHandler() {
     
      const doc = await getHandlerDoc(req, post);
      if (!doc) return 'Not found handler for HTTP ' + method + ' ' + req.path;

      const id = doc._id;
      debug('=> HTTP ' + method + ' ' + req.path);
      debug(post ? '   body: ' + util.inspect(req.body) : '   query:' + util.inspect(req.query));
      try {
        const filename = appconfig.getRestapihandlerFilename(id);
        if (!fs.existsSync(filename)) throw { message: 'Not found handler: ' + filename };
        require(filename)(req, res, holder, debug);
      } catch (e) {
        console.log('ERROR: httprestservice req.path ' + req.path + ': ' + util.inspect(e));
        const errStr = hut.getShortErrStr(e);
        debug('<= ' + JSON.stringify({ res: 0, message: errStr }));
        return errStr;
      }

      function debug(msg) {
        holder.emit('debug', 'scene_' + id, hut.getDateTimeFor(new Date(), 'shortdtms') + ' ' + msg);
      }
    }
  };

  async function getHandlerDoc(req, post = 0) {
    const parsed = url.parse(req.url, true);
    const endpoint = parsed.pathname;
    const rec = await holder.dm.dbstore.findOne('restapihandlers', { endpoint });
    if (rec) {
      return (rec.httpmethod == 'POST' && post) || (rec.httpmethod != 'POST' && !post) ? rec : '';
    }
  }
};
