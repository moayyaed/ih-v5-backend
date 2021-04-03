/**
 * build.js
 */

const util = require('util');
const fs = require('fs');
const path = require('path');

// const hut = require('../lib/utils/hut');
const fut = require('../lib/utils/fileutil');
const wu = require('../lib/utils/wrappers');

(async () => {
  const workpath = path.resolve(process.cwd());
  const deploypath = path.join(workpath, '..', 'builds');
  console.log('Backend build has started. Current folder ' + workpath + '  Deploy folder ' + deploypath);

  try {
    fut.createEmptyFolder(deploypath);
    await buildOne('intrahouse');
    await buildOne('intrascada', '_s_');
  } catch (err) {
    console.log('ERROR: Build Exception ' + util.inspect(err));
    setTimeout(() => {
      process.exit();
    }, 500);
  }

  async function buildOne(name, pref) {
    const dest = path.join(deploypath, name);
    fut.createEmptyFolder(dest);
    await wu.cpP({ src: workpath, dest });
    processFolder(dest, pref);

  }

  function processFolder(folder, pref) {
    fs.readdirSync(folder).forEach(filename => {
      const stats = fs.statSync(folder + '/' + filename);
      if (stats.isDirectory()) {
        processFolder(folder + '/' + filename, pref);
      } else if (filename.startsWith('_')) {
        processFile(folder, filename, pref);
      }
    });
  }

  function processFile(folder, filename, pref) {
    const from = folder + '/' + filename;
    if (pref && filename.substr(0, 3) == pref) {
      const to = folder + '/' + filename.substr(3);
      fs.renameSync(from, to);
      console.log('RENAME '+from+' => '+to)
    } else {
      fs.unlinkSync(from);
      console.log('REMOVE '+from)
    }
  }
})();
