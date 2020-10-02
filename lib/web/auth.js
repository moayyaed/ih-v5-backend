const util = require('util');

const ucrypto = require('../utils/ucrypto');

const dm = require('../datamanager');

exports.getUserByLogin = getUserByLogin;
exports.getUserByToken = getUserByToken;
exports.createNewToken = createNewToken;
exports.isGuest = isGuest;



async function getUserByLogin(login, pwd) {
  const user = await dm.dbstore.findOne('users', { login });
  return user && ucrypto.getHashPw("intrahouse"+user.pwd) == pwd ? user : '';
}

async function getUserByToken(token) {
  const rec = await dm.dbstore.findOne('tokens', { _id:token });
  console.log('getUserByToken '+token+' rec='+util.inspect(rec))
  if (rec && rec.login) {
    return dm.dbstore.findOne('users', { login: rec.login });
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
  const doc = {_id:token, login}; // Как будет чиститься??

  dm.insertDocs('tokens', [doc]);  // Сохранения не ждем?
  return token;
}

function isGuest(user) {
 return (user && user.role && user.role.substr(1) == 'guest'); // Aguest, Uguest
}

