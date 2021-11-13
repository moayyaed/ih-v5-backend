/**
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const Respondero = require('./respondero');
const domaindata = require('./domaindata');

async function execCommand(clid, mes, holder) {
  if (!mes.id) return { err: 'Missing visscript id!' };

  // Найти скрипт
  const filename = appconfig.getVisScriptFilename(mes.id);
  if (!fs.existsSync(filename)) return { err: 'Script not found!' };

  // Создать responder
  const responder = new Respondero(clid, holder);

  const local = domaindata.getLocalVarsObject();

  // Запустить скрипт
  try {
    // mes.context: {username: "test", start_layoutid: "l015", layoutid: "l022"}
    // mes.local: {local002: {left_menu: 2}, local003: {level: 0}}
    if (mes.local) {
      Object.keys(mes.local).forEach(id => {
        const item = mes.local[id];
        Object.assign(local, item);
      });
    }

    // console.log('INFO: BEFORE req local='+util.inspect(local));
    require(filename)({ local, context:mes.context }, responder);
    return {};
  } catch (e) {
    console.log('ERROR: visscript ' + filename + ': ' + util.inspect(e));
    return { err: 'Ошибка при выполнении скрипта!' };
  }
}

module.exports = {
  execCommand
};
