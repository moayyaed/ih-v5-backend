/**
 * appcrypto.js
 */

// const util = require('util');
const fs = require('fs');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');

const hut = require('./hut');

const iv = '1234567890123456';

class Appcrypto {
  start(pemFile, hwid) {
    this.hwid = hwid;
    try {
      const pemString = fs.readFileSync(pemFile);
      this.RSAkey = new NodeRSA(pemString);
    } catch (e) {
      console.log('ERROR: Appcrypto ' + hut.getShortErrStr(e));
    }
  }

  encryptPublic(buffer) {
    return this.RSAkey ? this.RSAkey.encrypt(buffer, 'base64') : '';
  }

  decrypt(str, hkey) {
    hkey = hkey || this.hwid;
    const hash = crypto
      .createHash('md5')
      .update(hkey)
      .digest();
    // const hash = crypto.createHash('md5').update(this.hwid).digest();

    const decipher = crypto.createDecipheriv('aes-128-cbc', hash, iv);

    let decrypted = decipher.update(str, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encrypt(str, hkey) {
    hkey = hkey || this.hwid;
    const hash = crypto
      .createHash('md5')
      .update(hkey)
      .digest();

    const cipher = crypto.createCipheriv('aes-128-cbc', hash, iv);

    let encrypted = cipher.update(str, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }
}

module.exports = new Appcrypto();
