/**
 * deviceserver.js
 * Сервер устройств
 */

const dm = require('../datamanager');
const Deviceengine = require('./deviceengine'); 
const Devicemate = require('./devicemate'); 

const typestore = require('../device/typestore');

module.exports = async function (holder) {
 
  const engine = new Deviceengine(holder, typestore);
  const mate = new Devicemate(engine, dm);
 
  engine.start(await mate.start());
};
