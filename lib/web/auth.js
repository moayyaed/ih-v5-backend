const util = require('util');

const ucrypto = require('../utils/ucrypto');

const appconfig = require('../appconfig');
const dm = require('../datamanager');

exports.getUserByLogin = getUserByLogin;
exports.getUserByToken = getUserByToken;
exports.createNewToken = createNewToken;
exports.createOneTimeToken = createOneTimeToken;
exports.isGuest = isGuest;
exports.adminAccessAllowed = adminAccessAllowed;
exports.checkToken = checkToken;
exports.hasUserRightsToUIAction = hasUserRightsToUIAction;

async function getUserByLogin(login, pwd) {
  if (isDefUserLogin(login)) return checkDefUser(pwd) ? defUser() : '';

  const user = await dm.dbstore.findOne('users', { login });
  return user && checkPw(user, pwd) ? user : '';
  // return user && ucrypto.getHashPw('intrahouse' + user.pwd) == pwd ? user : '';
}

function checkPw(user, pwd) {
  if (ucrypto.getHashPw('intrahouse' + user.pwd) == pwd) return true;
  if (ucrypto.getHashPw(user.pwd) == pwd) return true;
}

async function getUserByToken(token) {
  if (!token) return;
  const rec = await dm.dbstore.findOne('tokens', { _id: token });
  if (rec && rec.login) {
    return isDefUserLogin(rec.login) ? defUser() : dm.dbstore.findOne('users', { login: rec.login });
  }
}

/**
 * Процедура генерации нового токена
 * - Генерировать токен
 * - Сохранить новый токен в tokens
 * @param {String} login
 */
function createNewToken(login) {
  const token = ucrypto.getToken();
  const doc = { _id: token, login }; // Как будет чиститься??

  dm.insertDocs('tokens', [doc]); // Сохранения не ждем?
  return token;
}

function createOneTimeToken(login) {
  return ucrypto.getToken();
}

function isGuest(user) {
  return user && user.role && user.role.startsWith('guest'); // guest_admin, guest_user
}

function isAnyAdmin(user) {
  return user && user.role && user.role.indexOf('admin') >= 0; // admin, guest_admin,
}

function isRestrictedContent(query) {
  // Некоторые подразделы - доступ только для admin
  return query && query.id == 'access'; // Доступ к разделу учетных записей
}

function adminAccessAllowed(user, query) {
  if (!user.role) return true; // Пока

  return (!isRestrictedContent(query) && isAnyAdmin(user)) || user.role == 'admin';
}

function defUserLogin() {
  return 'ihadmin';
}

function isDefUserLogin(login) {
  return login == defUserLogin();
}

function checkDefUser(pwd) {
  const defPw = '9d90b3502b99b5fb0396e983a86efc1ac492ab26ca752a4c1995e588a4406478';
  return defPw == pwd;
}

async function getAdminLayout() {
  const docs = await dm.dbstore.get('users', { role: 'admin' });

  let layout = '';

  if (docs) {
    for (let doc of docs) {
      if (doc.mainlay) layout = doc.mainlay;
    }
  }
  return layout;
}

async function defUser() {
  const name = defUserLogin();
  const mainlay = await getAdminLayout();

  return {
    _id: 'ihadmin',
    name,
    login: name,
    role: 'admin',
    mainlay,
    expert: 1
  };
}

async function checkToken(token) {
  const user = await getUserByToken(token);
  if (!user || !user.login) throw { error: 'INVALIDTOKEN', message: appconfig.getMessage('INVALIDTOKEN') };
}

function hasUserRightsToUIAction(user, action) {
  if (user.role != 'guest_user') return true;
  return action != 'devicecommand' && action != 'device' && action != 'setval';
}
