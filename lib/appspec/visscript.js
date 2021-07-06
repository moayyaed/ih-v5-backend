/**
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const Respondero = require('./respondero');

async function execCommand(clid, mes, holder) {
  if (!mes.id) return { err: 'Missing visscript id!' };

  // Найти скрипт
  const filename = appconfig.getVisScriptFilename(mes.id);
  if (!fs.existsSync(filename)) return { err: 'Script not found!' };

  // Создать responder
  const responder = new Respondero(clid, holder);

  // Запустить скрипт
  try {
    console.log('BEFORE req filename='+filename);
    require(filename)({}, responder);
    return {};
  } catch (e) {
    console.log('ERROR: visscript ' + filename + ': ' + util.inspect(e));
    return { err: 'Ошибка при выполнении скрипта!' };
  }
}

module.exports = {
  execCommand
};
