/**
 * deviceserver.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine'); 
const Devicemate = require('./devicemate'); 


module.exports = async function (holder) {
 
  const engine = new Deviceengine(holder);
  const mate = new Devicemate(engine, dm);
 
  engine.start(await mate.start());
};
