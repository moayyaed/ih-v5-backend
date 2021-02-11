/**
 * netutils.js
 */
const util = require('util');
const net = require('net');
const fs = require('fs');
const ur = require('url');
const http = require('https');

// var request = require('request');

exports.isPortAvailableP = isPortAvailableP;
exports.httpDownloadP = httpDownloadP;
exports.httpGetJsonP = httpGetJsonP;
exports.httpDownload = httpDownload;
exports.httpPostRawP =  httpPostRawP;

/**
 * Check if a port is being used
 *
 * @param {*} port
 */
function isPortAvailableP(port) {
  return new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once('error', err => (err.code == 'EADDRINUSE' ? resolve(false) : reject(err)))
      .once('listening', () => tester.once('close', () => resolve(true)).close())
      .listen(port);
  });
}

/**
 * Download: create an HTTP GET request and pipe its response into a writable file stream
 * @param {*} url
 * @param {*} dest
 */
function httpDownloadP(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest, { flags: 'wx' });
    let ct;
    const options = ur.parse(url);

    options.port = 443;
    options.headers = { 'user-agent': 'node.js' };
    options.timeout = 10000;
    http
      .get(options, response => {
        ct = response.headers['content-type'];

        if (response.statusCode === 200) {
          response.pipe(file);
        } else {
          file.close();
          fs.unlink(dest, () => {}); // Delete temp file
          // Здесь возможно
          if (response.statusCode === 302 && response.headers.location) {
            reject('location:' + response.headers.location);
          } else {
            reject({
              message: `Request: ${url}. Response code: ${response.statusCode} error: ${response.statusMessage}`
            });
          }
        }
      })
      .on('error', e => {
        file.close();
        fs.unlink(dest, () => {}); // Delete temp file
        e.message = 'Connection fail ' + url + (e && e.code ? ' (' + e.code + ')' : '');
        reject(e);
      });

    file.on('error', err => {
      file.close();
      fs.unlink(dest, () => {}); // Delete temp file
      reject(err);
    });

    file.on('finish', () => {
      resolve(ct);
    });
  });
}

/**
 * Download: create an HTTP GET request and resolve response
 * @param {*} url
 * @param {*} dest
 */
function httpGetJsonP(uri) {
  return new Promise((resolve, reject) => {
    let options = ur.parse(uri);

    options.port = 443;
    options.headers = { 'user-agent': 'node.js' };
    options.timeout = 10000;
    const req = http
      .get(options, response => {
        try {
          const ct = response.headers['content-type'];
          if (response.statusCode !== 200) {
            throw new Error(
              `Request: ${util.inspect(options)}. Response code: ${response.statusCode} error: ${
                response.statusMessage
              }`
            );
          }
          if (!/^application\/json/.test(ct)) throw new Error(`Expected application/json, received ${ct}`);
        } catch (e) {
          response.resume();
          reject(e);
        }

        response.setEncoding('utf8');
        let rawData = '';
        response.on('data', chunk => {
          rawData += chunk;
        });

        response.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('timeout', () => {
        req.destroy();
      })
      .on('error', e => {
        e.message = 'Connection fail ' + options.host + (e && e.code ? ' (' + e.code + ')' : '');
        reject(e);
      });
  });
}

/**
 * Download: create an HTTP GET request and pipe its response into a writable file stream
 * @param {*} url
 * @param {*} dest
 */
function httpDownload(url, dest, callback) {
  const file = fs.createWriteStream(dest, { flags: 'wx' });

  const request = http.get(url, response => {
    if (response.statusCode === 200) {
      response.pipe(file);
    } else {
      file.close();
      fs.unlink(dest, () => {}); // Delete temp file
      callback({ message: `Request: ${url}. Response code: ${response.statusCode} error: ${response.statusMessage}` });
    }
  });

  request.on('error', err => {
    file.close();
    fs.unlink(dest, () => {}); // Delete temp file
    callback(err);
  });

  file.on('finish', () => {
    callback();
  });

  file.on('error', err => {
    file.close();
    fs.unlink(dest, () => {}); // Delete temp file
    callback(err);
  });
}

function httpUrl(url) {
  return !url.startsWith('http://') ? 'http://' + url : url;
}

function httpPostRawP(opt, postData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: opt.hostname,
      port: 443,
      path: opt.path || '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, res => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');

      if (res.statusCode != 200) {
        res.resume();
        reject({message: opt.hostname+ ': statusCode='+res.statusCode});
      }

      let rawData = '';
      res.on('data', chunk => {
        // console.log(`BODY: ${chunk}`);
        rawData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', e => {
      console.error(`problem with request: ${e.message}`);
      reject(e);
    });

    // Write data to request body
    req.write(postData);
    req.end();
  });
}
