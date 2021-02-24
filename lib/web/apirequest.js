/**
 * apirequest.js
 *  middleware for /api:
 *    /api/admin?
 *    /api/user?
 *    /api/engine
 *    /api/export
 * 
 *   export выполняется в 2 шага:
 *   1.  datagetter.prepareToExport
 *    req => /api/admin?method=export&id=resources&nodeid=modbus1&param=channels
 *    res <= {title: "Каналы modbus1", url: "/api/export?param=channels&nodeid=modbus1", filename: "modbus1.csv"}
 *   2. doExport
 *    req => /api/export?param=channels&nodeid=modbus1  - это <url 1.>
 *    res <= <данные> Content-Type: text/csv; charset=UTF-8
 */

const util = require('util');
// const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;

const auth = require('./auth');

const appconfig = require('../appconfig'); // Получение текстов сообщений

const postapi = require('../api/postapi');
const getapi = require('../api/getapi');
const info = require('../api/info');
const enginereq = require('../api/enginereq');
const exportPack = require('../utils/exportPack');
const wu = require('../utils/wrappers');

const importPack = require('../utils/importPack'); // ТОЛЬКО ДЛЯ ОТЛАДКИ!!

module.exports = function(holder) {
  return async (req, res, next) => {
    // /api Уже обрезано /engine/startscene?id=1 || /admin?method=get
    const reqPath = req.path;
    if (reqPath.length < 2) return next(); // /api/ => '/'

    const pathArr = reqPath.substr(1).split('/');
    const part1 = pathArr.shift();
    const token = req.headers.token;
    const query = req.method == 'GET' ? req.query : req.body;

    try {
      if (!query) throw { error: 'ERRQUERY', message: 'No query!' };
      if (part1 == 'export') return doExport(res, query, holder);  // 2 шаг - выгрузка данных

      res.setHeader('Content-Type', 'application/json');
      // const dataObj = query.method == 'auth' ? await authResult(query, token) : await getDataObj(part1);
      const dataObj = query.method == 'auth' ? await authResult(query, req.headers) : await getDataObj(part1);

      const result = Object.assign({ response: 1 }, dataObj);
      res.send(JSON.stringify(result));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }

    async function getDataObj(part) {
      const user = await auth.getUserByToken(token);
      if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

      // TODO - здесь проверить права доступа!!!
      if (req.method != 'GET' && auth.isGuest(user)) throw { message: 'Операция не разрешена!' };

      switch (part) {
        case 'admin':
          if (!auth.adminAccessAllowed(user, query)) throw { message: 'Доступ не разрешен!' };
          return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);

        case 'user':
          return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);

        case 'engine':
          return enginereq(pathArr, req, user, holder);

        case 'info':
          return { data: await info(pathArr, req, user, holder) };

        case 'import': // только для ТЕСТА!!!
          return { data: await importPack(query.folder, 'test' + Date.now(), holder) };

        default:
          throw { message: 'Unknown endpoint ' + reqPath };
      }
    }
  };
};

/**
 *
 * @param {Object} query
 * @param {String} token
 * @return {Object} data object to send
 */
async function getApi(query, user, holder) {
  if (query.method == 'export') return holder.dm.datagetter.prepareToExport(query, user, holder); // 1 шаг - выгрузка данных

  if (!query.type) throw { error: 'ERRQUERY', message: 'Type not defined: ' + JSON.stringify(query) };

  const data = holder.dm.getFromCache(query); // Попытка считать из кэша без await
  return typeof data == 'object' ? data : getapi.get(query, user, holder);
}

/**
 *
 * @param {Object} body
 * @param {String} token
 * @return {Object} data object to send
 */
async function postApi(body, token, holder) {
  const { method, type, id } = body;
  console.log('POSTAPI typeof holder '+typeof holder+util.inspect(body))

  if (!method) throw { error: 'SORTERR', message: 'Method not defined for request!' };
  if (!type) throw { error: 'SORTERR', message: 'Type not defined for request!' };
  if (!id) throw { error: 'SORTERR', message: 'Id not defined for request!' };

  const apiFun = postapi[type][method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unknown type or method!' };
  return apiFun(body, holder);
}

async function authResult(query, headers) {
  const res = {};
  // const {username, password, token} = headers;
  const { username, password } = query;
  const token = headers.token;

  let user;
  if (username && password) {
    user = await auth.getUserByLogin(username, password);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };

    res.token = auth.createNewToken(username);
  } else if (token) {
    user = await auth.getUserByToken(token);
    if (!user) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };
  } else {
    if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
    if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
  }
 
  return { ...res, ...getUserData(user) };
}

function getUserData(user) {
  const savewarning = auth.isGuest(user) ? 'no' : 'auto';
  // Сюда же добавить язык??

  return { layout: user.mainlay, name: user.name, savewarning, lang: appconfig.get('lang') };
}

async function doExport(res, query, holder) {
  // Подготовить файл для выгрузки
  const { folder, name, error } = await prepare(query, holder);

  try {
    if (error) throw { message: error };
    let filepath;
    if (folder) {
      // Упаковать папку
      filepath = path.resolve(folder, '..', name.endsWith('.zip') ? name : name + '.ihpack');
      console.log('Folder ' + folder + 'zip to ' + filepath);
      await wu.zipP({ src: folder, dest: filepath });
    } else {
      // Отправить один файл - image или zip с картинками
      filepath = name;
    }
    res.download(filepath);

  } catch (e) {
    console.log('ERROR: export fail! ' + e.message);
    res.status(404).send('Error: ' + error);
  }
}

async function prepare(query, holder) {
  switch (query.param) {
    case 'image':
      return exportPack.exportImage(query, holder);
    case 'project':
      return exportPack.exportProject(query, holder);
  //  case 'channels':
  //      return exportCSV(query, holder);
    default:
      return exportPack.exec(query, holder);
  }
}


function streamZip(res, folderToZip) {
  // Options -r recursive -j ignore directory info - redirect to stdout
  const parArr = ['-rj', '-', folderToZip];
  const zip = spawn('zip', parArr);
  // const zip = spawn('zip', ['-rj', '-', folderToZip]);

  res.contentType('zip');
  res.setHeader('Content-Length', '2679');

  res.attachment(folderToZip + '.zip');

  zip.stdout.on('data', data => {
    res.write(data);
  });

  let stderr = '';
  zip.stderr.on('data', data => {
    stderr += data; // Вывод имен файлов в формате:  adding: vt097.json (deflated 81%)
  });

  zip.on('exit', code => {
    if (code !== 0) {
      console.log('ERROR: spawn: zip ' + parArr.join(' ') + '\n error code=' + code + ', stderr:\n' + stderr);
      res.status(404).send('Sorry cant export that! Zip error code=' + code);
    }
    res.end();
  });
}
