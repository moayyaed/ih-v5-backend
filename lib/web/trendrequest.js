/**
 *  trendrequest.js
 * 
 *  Middleware function for endpoint  /trend
 * 
 *  /trend?id=yy&start..&end=..&did_prop= 
 */

const util = require('util');

// const hut = require('../utils/hut');

const dbconnector = require('../dbconnector');

module.exports = function(holder) {
  return async (req, res) => {
    const query = req.query;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (!query.id) throw { message: 'Expected id in query: ' + util.inspect(query) };
      if (!query.start) throw { message: 'Expected start in query: ' + util.inspect(query) };

      // Может быть dn_prop или did_prop
      // did_prop заменить на dn_prop
      if (query.did_prop) {
        query.dn_prop = getDnProp(query.did_prop);
      }
      // const data = await getData(query);
      const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop, target: 'trend' };
      const data = (query.start > Date.now()) ?  [] : await dbconnector.read(readObj);

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ response: 1, data }));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }
  };

  function getDnProp(did_prop) {
    const didArr = did_prop.split(',');
    if (!didArr || !didArr.length) return '';
    const arr = didArr
      .filter(el => el && el.indexOf('.') > 0)
      .map(el => {
        const [did, prop] = el.split('.');
        return holder.devSet[did] ? holder.devSet[did] + '.' + prop : did_prop;
      });
    return (arr.length) ? arr.join(','): '';  
  }
};

/*
async function getData(query) {
  if (query.start > Date.now()) return [];

  const readObj = { start: query.start, end: query.end || Date.now(), dn_prop: query.dn_prop, target: 'trend' };
  return dbconnector.read(readObj);
}
*/