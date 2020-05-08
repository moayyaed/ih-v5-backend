/**
 * trendserver.js
 *
 */

const dm = require('../datamanager');
const Trendengine = require('./trendengine');
const Trendmate = require('./trendmate');

module.exports = async function(holder) {
  const engine = new Trendengine(holder);
  const mate = new Trendmate(engine, dm);

  engine.start(await mate.start());
};
