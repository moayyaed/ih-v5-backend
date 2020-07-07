/**
 * handlerutils.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

const hut = require('../utils/hut');
const appconfig = require('../appconfig');

const ROOT = 'handlergroup';

const readScript = `
module.exports = function(device, prop, value) {
  
  return value;
  // return {value:42, err:1};
  // return {};
};`;

const calculateScript = `
module.exports = function(device, prop) {
  if (prop == 'state') return device.value > 0 ? 1 :0;

};`;

const commandScript = `
module.exports = function(device) {
  device.set('value', 1);
};`;

async function syncHandlers(docs) {
  console.log('SYNC HANDLER START path=' + appconfig.getHandlerPath());
  const changeDocs = [];
  try {
    const folder = appconfig.getHandlerPath();
    const fileNames = await fs.promises.readdir(folder);
    const scriptNames = fileNames.filter(el => el.endsWith('.js')).map(el => el.substr(0, el.length - 3));
    console.log('SYNC HANDLER scriptNames=' + scriptNames);

    const docsObj = hut.arrayToObject(docs, '_id');

    // const promises = scriptNames.map(name => (!docsObj[name] ? createNewDocFromFile(name) : ''));
    //  _id - имя файла без расширения
    const promises = scriptNames.map(_id => getScriptFromFile(folder, _id));

    // [{_id, str},..]
    const scriptArr = await Promise.all(promises); // Считать все скрипты и проверить тип

    // Если записи для файла нет - создать новую запись,
    // Название и тип - проверить, исправить если не совпадают
    scriptArr.forEach(item => {
      const _id = item._id;
      const changeDoc = !docsObj[_id] ? createNewDoc(_id, item.str) : verifyDoc(_id, item.str, docsObj[_id]);
      if (changeDoc) changeDocs.push(changeDoc);
    });

    // changeDocs = await Promise.all(promises);

    // Проверить, что для каждой записи таблицы есть файл в папке.
    // Если нет - пометить как отсутствующий
    docs.forEach(doc => {
      if (!scriptNames.includes(doc._id)) {
        changeDocs.push(missingScriptFile(doc._id));
      }
    });
  } catch (e) {
    console.log('Error syncScripts ' + util.inspect(e));
  }
  console.log('SYNC HANDLER changeDocs=' + util.inspect(changeDocs));

  return changeDocs;
}

function createNewDoc(_id, str) {
  const item = handlerStrToObj(_id, str);
  return { new: 1, parent: ROOT, ...item };
}

function verifyDoc(_id, str, olddoc) {
  const item = handlerStrToObj(_id, str);
  if (olddoc.name != item.name) setUpdated('name', item.name);
  if (olddoc.type != item.type) setUpdated('type', item.type);
  if (olddoc.err) {
    setUpdated('err', 0);
    setUpdated('errstr', '');
  }
  return olddoc.$set ? olddoc : '';

  function setUpdated(prop, val) {
    if (!olddoc.$set) olddoc.$set = {};
    olddoc.$set[prop] = val;
  }
}

function missingScriptFile(id) {
  return { _id: id, $set: { unget: 1, err: 1, errstr: 'Script not found!' } };
}

function getNewScriptHeader(type) {
  const res = { name: 'New function', type, desc: '' };
  switch (type) {
    case 'command':
      res.name = 'New command';
      break;
    case 'calculate':
      res.name = 'New calculate function';
      break;
    default:
  }
  return res;
}

function createNewScriptFromTemplate(id, headerObj) {
  let str = `
/**
 * @name ${headerObj.name}
 * @type ${headerObj.type}
 * @desc ${headerObj.desc}
 */
${getNewScriptBody(headerObj.type)}
`;

  return createScriptFile(id, str);
}

function getNewScriptBody(type) {
  switch (type) {
    case 'command':
      return commandScript;
    case 'calculate':
      return calculateScript;
    default:
      return readScript;
  }
}


async function createScriptFile(sceneId, scriptStr) {
  return fs.promises.writeFile(appconfig.getHandlerFilename(sceneId), scriptStr, 'utf8');
}

async function getScriptFromFile(folder, _id) {
  const filename = path.join(folder, _id + '.js');
  const str = await fs.promises.readFile(filename, 'utf8');
  return {_id, str};
  // return  handlerStrToObj(_id, str);
}

function handlerStrToObj(_id, str) {
  // Разобрать заголовок и сам файл??
  const { comment, script } = splitCommentAndScript(str);
  const {name, type} = extractCommentFields(comment); // Лишнее не брать - только name, type
  return {_id, name, type};
  // return {_id, name, type, script};
}

/**
 * Выделить в скрипте комментарий и непосредственно сам скрипт (module.exports)
 *
 */
function splitCommentAndScript(astr) {
  // Файл должен начинаться с обязательного комментария /* */, из него берется описание
  // Все, что выше первого комментария, игнорируется
  let str = astr;
  let comment = '';
  let scriptstr = '';
  let j;
  try {
    j = str.indexOf('*/');
    if (j >= 0) {
      comment = hut.allTrim(str.substr(0, j - 1)); // */ не нужен
      str = hut.allTrim(str.substr(j + 2));
    }

    j = str.search(/module.exports\s*=\s*function/);
    if (j >= 0) {
      scriptstr = str.substr(j);
    }
  } catch (e) {
    console.log(
      'ERROR ' + util.inspect(e) + ' input:' + astr + ' J=' + j + ' typeof str=' + typeof str + util.inspect(str)
    );
  }

  return { comment, scriptstr };
}

function extractCommentFields(comment) {
  const result = {};
  const regexp = /(@[^\s]*)/; // Выделить все символы после  @ до пробела
  if (comment) {
    comment.split('\n').forEach(str => {
      let arrx = regexp.exec(str);
      if (arrx && arrx[0] && arrx.index) {
        const field = arrx[0].substr(1);
        if (field) {
          const val = str.substr(arrx.index + field.length + 1);
          result[field] = val;
        }
      }
    });
  }
  return result;
}

module.exports = {
  syncHandlers,
  createNewScriptFromTemplate,
  getNewScriptHeader,
  handlerStrToObj,
  createNewDoc,
  verifyDoc

};
