/**
 * uploadfiles.js
 */

const util = require('util');
const fs = require('fs');
// const path = require('path');

const appconfig = require('../appconfig');

module.exports = function uploadfiles(req, res) {
  console.log('WARN: ' + util.inspect(req, null, 5));

  try {
    const files = req.files.files;
    /*
     // const params = JSON.parse(req.body.params);
    switch (params.type) {
      case 'imagelist':
        imagelist(name, data, params, res);
        break;

      case 'image':
        image(name, data, params, res);
        break;
      case 'plugin':
   */

    if (Array.isArray(files)) {
      res.send('GOT ' + files.length + ' files');
    } else {
      const folder = appconfig.getImagePath();
      const filename = folder + '/' + files.name;

      fs.promises
        .writeFile(filename, files.data)
        .then(() => {
          res.send('GOT ONE FILE ' + files.name + ' size=' + files.size);
        })
        .catch(e => {
          res.status(500).end('Error upload: ' + util.inspect(e));
        });
      /*
      let promise = Promise.resolve();
      files.forEach((file) => {
  promise = promise.then(() => {
       return task();
  }); 
  
});
*/
    }
  } catch (e) {
    res.status(500).end('Error upload: ' + util.inspect(e));
  }

  function image(name, data, params, res) {
    fs.writeFile(`${appconfig.getProjectPath()}/${params.folder}/${name}`, data, () => {
      res.status(200).end('OK');
    });
  }
};

/*
files: {
    files: {
      name: ' actor_blk.png',
      data: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 01 fb 00 00 02 a9 08 02 00 00 00 34 47 12 e4 00 00 00 01 73 52 47 42 00 ae ce 1c e9 00 00 00 09 ... 67305 more bytes>,
      size: 67355,
      encoding: '7bit',
      tempFilePath: '',
      truncated: false,
      mimetype: 'image/png',
      md5: '6a0e5cdee28cc8f58cb9c2481d89a6e8',
      mv: [Function: mv]
    }
  },
*/
