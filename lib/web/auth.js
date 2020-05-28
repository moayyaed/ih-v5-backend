const ucrypto = require('../utils/ucrypto');

const dm = require('../datamanager');

exports.getUserByLogin = getUserByLogin;
exports.getUserByToken = getUserByToken;
exports.createNewToken = createNewToken;


async function getUserByLogin(login, pwd) {
  const user = await dm.dbstore.findOne('users', { login });
  return user && user.pwd == pwd ? user : '';
}

function getUserByToken(token) {
 
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


