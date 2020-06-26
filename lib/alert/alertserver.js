/**
 * alertserver.js
 * Сервер alert-ов
 */

const dm = require('../datamanager');
const Alertengine = require('./alertengine');
const Alertmate = require('./alertmate');

module.exports = async function(holder) {
  const engine = new Alertengine(holder);
  const mate = new Alertmate(engine, dm);
  const docs = await mate.start();
  engine.start(docs);
};
