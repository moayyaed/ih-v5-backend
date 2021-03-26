/**
 * upgradeProject.js
 */

// const util = require('util');
const fs = require('fs');
// const path = require('path');

// const hut = require('./hut');
const appconfig = require('../appconfig');
const wu = require('../utils/wrappers');



// from=5.0 to=5.2
module.exports = async function (project, from, to) {
  console.log('WARN: NEED upgrade project ' + project + ' v' + from + ' to v' + to);
  if (!project || !from || !to || from.indexOf('.') <= 0 || to.indexOf('.') <= 0) {
    return;
  }

  let zipfile;
  const projectpath = appconfig.get('projectpath');
  try {
   
    const scriptArr = gatherScriptArr(from, to);
    if (scriptArr.length > 0) await runUpgradeScripts(projectpath, scriptArr);
    // Проставить версию в проекте
    appconfig.setTheProjectVersion(project);
    console.log('WARN: Upgrade OK');
  } catch (e) {
    console.log('ERROR: Project Upgrade error. ' + e.message);
    // восстанавливаем из архива, если он есть
    if (zipfile) {
      await wu.unzipP({ src: zipfile, dest: projectpath });
      console.log('WARN: Restore project from: ' + zipfile);
    }
  }
}

function gatherScriptArr(from, to) {
  const upScriptPath = `${appconfig.get('appdir')}/upgrade`;
  const scriptArr = [];
  // Создать массив имен скриптов, если они существуют
  let fromx = Number(from.split('.').pop());
  let tox = Number(to.split('.').pop());

  if (fromx < tox) {
    for (let i = fromx; i < tox; i++) {
      let file = `${upScriptPath}/up_${i}_${i + 1}.js`;

      if (fs.existsSync(file)) {
        scriptArr.push(file);
        console.log('WARN: Exists upgrade script ' + file);
      }
    }
  }
  return scriptArr;
}

function runUpgradeScripts(projectpath, all) {
  let promise = Promise.resolve();
  all.forEach(script => {
    promise = promise.then(() => runOne(script));
  });
  return promise;

  function runOne(script) {
    return new Promise((resolve, reject) => {
      require(script)(projectpath)
        .then(() => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
  }
}