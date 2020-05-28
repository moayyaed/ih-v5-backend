const crypto = require('crypto');

const iv = '1234567890123456';



exports.createDH = createDH;
exports.cipherStr = cipherStr;
exports.decipherStr = decipherStr;

exports.getHashPw = getHashPw;
exports.getToken = getToken;
exports.createServerKey = createServerKey;


function getHashPw(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}


function getToken() {
  return crypto.randomBytes(32).toString('hex');
}



function createDH() {
  return crypto.createDiffieHellman(128, 'hex');
}

function cipherStr(str, key) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), iv);

  let encrypted = cipher.update(str, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decipherStr(str, key) {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key, 'hex'), iv);

    let decrypted = decipher.update(str, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    throw { message: 'DECRYPT ERROR:key=' + key + ' str=' + str + ' ' + e.message };
  }
}


function createServerKey() {
  return crypto.randomBytes(16).toString("base64");
}

