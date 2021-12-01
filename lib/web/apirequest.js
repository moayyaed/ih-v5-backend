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
 *
 *  import выполняется в middleware /upload
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

      if (part1 == 'export') return doExport(res, query, holder); // 2 шаг - выгрузка данных
      /*
      const dataObj =
        query.method == 'auth' || query.method == 'auth2'
          ? await authResult(query, req.headers, holder)
          : await getDataObj(part1);
      */

     let dataObj;
     if (query.method == 'auth' ) {
      dataObj = await authResult(query, req.headers, part1, holder);
     } else if (query.method == 'auth2') {
        dataObj = await authResult2(query, holder);
      } else {
        dataObj = await getDataObj(part1);
     }

      const result = Object.assign({ response: 1 }, dataObj);

      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result));
    } catch (e) {
      console.log('CATCH error' + util.inspect(e));
      res.send(JSON.stringify({ response: 0, error: e.error, message: e.message, data: e.data }));
    }

    async function getDataObj(part) {
      const user = await auth.getUserByToken(token);
      if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };

      // Проверка возможности выполнить действие или команду
      await checkAbility(query, user, holder); //

      query.userId = user._id;
      query.__expert = user.expert;

      switch (part) {
        case 'admin':
          return adminResponse(user);
        // return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);

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

    async function adminResponse(user) {
      // Проверить, имеет ли пользователь полный доступ к админке или ограниченный
      const alevel = holder.am.getPMAccessLevel(user._id);
      if (!alevel) throw { message: 'PM alevel='+alevel+' '+appconfig.getMessage('ACCESSDENIED') };

      if (alevel < 2) {
        if (!holder.am.isPMQueryAllowed(query, user._id))
          throw { message: 'query = '+util.inspect(query)+' '+appconfig.getMessage('ACCESSDENIED') };

        // POST - это редактирование - проверить флаг pm_readwrite
        if (req.method != 'GET') {
          if (!holder.am.hasUserPMWritePermission(user._id))
            throw { message: appconfig.getMessage('InsuffRightsForAction') };
        }
      }
      return req.method == 'GET' ? getApi(query, user, holder) : postApi(query, user, holder);
    }
  };
};

/**
 * Проверить, есть ли возможность выполнить запрос (команду)
 * TODO - здесь же проверять права!!
 *
 * @param {*} query
 * @param {*} user
 * @param {*} holder
 */
async function checkAbility(query, user, holder) {
  if (!query) return;

  const { id, nodeid, method, payload } = query;
  if (method == 'send' && payload && payload.emit) {
    if (payload.emit == 'start:scene') {
      // nodeid - id сценария
      if (!holder.sceneSet[nodeid]) throw { message: 'Сценарий/мультисценарий не может быть запущен!' };
      if (holder.sceneSet[nodeid].blk) throw { message: 'Сценарий заблокирован!' };
    }
  }
}

/**
 *
 * @param {Object} query
 * @param {String} token
 * @return {Object} data object to send
 */
async function getApi(query, user, holder) {
  if (query.method == 'export') return holder.dm.datagetter.prepareToExport(query, user, holder); // 1 шаг - подготовка к выгрузке данных

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

  if (!method) throw { error: 'SORTERR', message: 'Method not defined for request!' };
  if (!type) throw { error: 'SORTERR', message: 'Type not defined for request!' };
  if (!id) throw { error: 'SORTERR', message: 'Id not defined for request!' };

  const apiFun = postapi[type][method];
  if (!apiFun) throw { error: 'SORTERR', message: 'Unknown type or method!' };
  return apiFun(body, holder);
}

// Проверить 
async function authResult(query, headers, part1, holder) {
  const res = {};
  const { username, password} = query;
  // if (method == 'auth2') return authResult2(username, password, holder);

  const token = headers.token;
  let needNewToken;
  let user;
  if (username && password) {
    user = await auth.getUserByLogin(username, password);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };
    needNewToken = true;
   
  } else if (token) {
    user = await auth.getUserByToken(token);
    if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDTOKEN') };
  } else {
    if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
    if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
  }
  
  // Проверяем, есть ли общий доступ к админке
  /** ПОКА ЛЮБОЙ ВХОД имет через /api/admin
  if (part1 == 'admin') {
   if  (!holder.am.getPMAccessLevel(user._id))  throw { message: appconfig.getMessage('ACCESSDENIED') };
  }
  */

  if (needNewToken)  res.token = auth.createNewToken(username);
  return { ...res, ...getUserData(user) };
}

function getUserData(user) {
  const savewarning = 'auto';
  // Сюда же добавить язык и имя проекта

  return {
    layout: user.mainlay,
    name: user.name,
    savewarning,
    lang: appconfig.get('lang'),
    project: appconfig.get('project_title'),
    conf: appconfig.get('conf') || 0,
    docs: appconfig.get('docs') || 0,
    modules: appconfig.getAddons()
  };
}


// async function authResult2(username, password, holder) {
async function authResult2({username, password}, holder) {
  if (!username) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYLOGIN') };
  if (!password) throw { error: 'ERRAUTH', message: appconfig.getMessage('EMPTYPWD') };
  const user = await auth.getUserByLogin(username, password);
  if (!user) throw { error: 'ERRAUTH', message: appconfig.getMessage('INVALIDPWD') };

  // Только для пользователей с флагом "Эксперт"
  if (!user.expert) throw { error: 'ERRAUTH', message: appconfig.getMessage('NOTEXPERT') };

  return { p2pkey: getP2pKey(holder) };
}

function getP2pKey(holder) {
  const dn = '__UNIT_p2p';
  return holder.devSet[dn] && holder.devSet[dn].key ? holder.devSet[dn].key : '';
}

async function doExport(res, query, holder) {
  // Подготовить файл для выгрузки
  const { folder, name, error, exclude } = await holder.dm.datagetter.exportOne(query, holder);
  // console.log('WARN: doExport query='+util.inspect(query)+ ' folder='+folder)

  try {
    if (error) throw { message: error };
    let filepath;
    if (folder) {
      // Упаковать папку
      filepath = path.resolve(folder, '..', name.endsWith('.zip') ? name : name + '.zip');
      console.log('WARN: Folder ' + folder + '  zip to ' + filepath);
      await wu.zipP({ src: folder, dest: filepath, exclude });
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
