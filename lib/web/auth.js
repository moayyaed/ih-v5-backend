// const util = require('util');

const ucrypto = require('../utils/ucrypto');

const dm = require('../datamanager');

exports.getUserByLogin = getUserByLogin;
exports.getUserByToken = getUserByToken;
exports.createNewToken = createNewToken;
exports.isGuest = isGuest;
exports.adminAccessAllowed = adminAccessAllowed;

async function getUserByLogin(login, pwd) {
  if (defUserLogin(login)) return checkDefUser( pwd) ? defUser() : '';

  const user = await dm.dbstore.findOne('users', { login });
  return user && ucrypto.getHashPw('intrahouse' + user.pwd) == pwd ? user : '';
}

async function getUserByToken(token) {
  if (!token) return;
  const rec = await dm.dbstore.findOne('tokens', { _id: token });
  // console.log('getUserByToken ' + token + ' rec=' + util.inspect(rec));
  if (rec && rec.login) {
    return defUserLogin(rec.login) ? defUser() : dm.dbstore.findOne('users', { login: rec.login });
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

function defUserLogin(login) {
  return login == defUser().login;
}

function checkDefUser( pwd) {
  const defPw = '9d90b3502b99b5fb0396e983a86efc1ac492ab26ca752a4c1995e588a4406478';
  return (defPw == pwd);
}

function defUser() {
  const name = 'ihadmin';
    return {
      name,
      login:name,
      role: 'admin',
      layout: '' // layout
    };
}
