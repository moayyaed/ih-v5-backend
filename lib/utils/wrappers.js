/*
 * wrappers.js
 */

const fs = require('fs');
const util = require('util');
const spawn = require('child_process').spawn;
const fork = require('child_process').fork;
const path = require('path');

const hut = require('./hut');
const fut = require('./fileutil');
const appconfig = require('./appconfig');

exports.zipP = zipP;
exports.zipfileP = zipfileP;
exports.unzipP = unzipP;
exports.rsyncP = rsyncP;
exports.cpP = cpP;
exports.installNodeModulesP = installNodeModulesP;
exports.tryRunCmdP = tryRunCmdP;

exports.forkChilds = forkChilds;

/**
 *  Wrapper for zip command
 */
function zipP(options) {
  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
    if (!fs.existsSync(options.src)) throw { message: `Directory not found ${options.src}` };
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }

  let cmd;
  if (appconfig.isWindows()) {
    cmd = getToolPath('zip') + ' a ' + options.dest + ' * -r'; // -r  recursion
  } else {
    cmd = `zip -r  ${options.dest} ./*`;
  }

  return tryRunCmdP(cmd, { cwd: options.src });
}

function zipfileP(options) {
  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
    if (!options.dest) throw { name: 'SoftError', message: '"dest"  directory is missing from options' };
    if (!fs.existsSync(options.src)) throw { message: `File not found ${options.src}` };
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }

  let cmd;
  if (appconfig.isWindows()) {
    cmd = getToolPath('zip') + ' a ' + options.dest + ' ' + options.src;
  } else {
    cmd = `zip ${options.dest} ./${path.basename(options.src)}`;
  }
  return tryRunCmdP(cmd, { cwd: path.dirname(options.src) });
}

/**
 *  Wrapper for unzip command
 */
function unzipP(options) {
  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
    if (!fs.existsSync(options.src)) throw { message: `File not found ${options.src}` };
  } catch (err) {
    return Promise.reject({ message: 'Before run unzip: ' + err.message });
  }

  let cmd;
  let dest;
  if (appconfig.isWindows()) {
    dest = options.dest ? ` -o${options.dest}` : ''; // -o целевая папка
    cmd = getToolPath('unzip') + ' x -y ' + options.src + dest;
  } else {
    dest = options.dest ? ` -d ${options.dest}` : ''; // -d целевая папка
    cmd = `unzip -o  ${options.src} ${dest}`; // -o  overwrite files without prompting
  }

  return tryRunCmdP(cmd);
}

/**
 *  Wrapper for cp command
 */
function cpP(options) {
  let cmd;
  if (appconfig.isWindows()) {
    cmd = `Xcopy /E /Y ${options.src} ${options.dest}`;
  } else {
    cmd = `cp -r ${options.src}/* ${options.dest}/`; // -r  recursion
  }

  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }

  return tryRunCmdP(cmd);
}

/**
*  Wrapper for rsync command to backup files.
*   !!!! rsync >=2.6.9 in PATH is needed.
*   For remote host run rsync over ssh.

*   @param {Object}  options:
*      src     [String] Path to src. 
*      srchost [String] Ssh host, if src is remote host. Ex:'userA@213.77.55.222'

*      dest    [String] Path to destination. 
*      desthost[String] Ssh host, if dest is remote host. Ex:'userB@46.88.20.28'

*      port    [String] If ssh host uses a non standard SSH port (not 22) then set it here. Ex:'5055'
*      privateKey [String] To specify an SSH private key other than the default for ssh host. 

*      backup  [String] Path to backup folder

*      exclude [Array<String>] Optional array of rsync patterns to exclude from transfer.

*      noExec [Boolean] default: false`
**/
function rsyncP(options) {
  let cmd;

  try {
    if (!options) throw { name: 'SoftError', message: 'Missing options parameter' };
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
    if (!options.dest) throw { name: 'SoftError', message: '"dest" directory is missing from options' };

    if (appconfig.isWindows()) {
      // Чтобы использовать cwrsync - пути нужны Unix и вместо C:\\ -> /cygdrive/C/....
      // использовать просто xcopy - без backup

      // options.dest = path.join(options.dest, 'intrahouse-c');
      cmd = `Xcopy /Y /E ${options.src} ${options.dest}`;
    } else {
      // Для rsync целевая папка должна быть выше на уровень, т е содержать обновляемую папку внутри себя!!
      options.dest = path.join(options.dest, '..');
      cmd = formRsyncCmd(options);
    }
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }

  return options.noExec ? Promise.resolve(cmd) : tryRunCmdP(cmd);
}

function formRsyncCmd(options) {
  let cmd = (appconfig.isWindows() ? getToolPath('rsync') : 'rsync') + ' ';

  let src;
  let dest;

  src = options.src;
  if (options.srchost) {
    src = options.srchost + ':' + src;
  }

  dest = options.dest;
  if (options.desthost) {
    dest = options.desthost + ':' + dest;
  }

  cmd += src + ' ' + dest;

  if (options.flags) {
    cmd += ' ' + options.flags;
  }

  if (options.backup) {
    cmd += ' --backup --backup-dir=' + options.backup;
  }

  if (options.exclude && util.isArray(options.exclude)) {
    for (var i = 0; i < options.exclude.length; i++) {
      let exfile = hut.allTrim(options.exclude[i]);
      if (exfile) {
        cmd += ' --exclude=' + exfile;
      }
    }
  }

  if (options.port || options.privateKey || options.noHostKeyChecking) {
    cmd +=
      ' --rsh "ssh ' +
      (options.port ? ' -p ' + options.port : '') +
      (options.privateKey ? ' -i ' + options.privateKey : '') +
      (options.noHostKeyChecking ? ' -o StrictHostKeyChecking=no ' : '') +
      '"';
  }
  return cmd;
}

// Launch cmd in a shell just like Node's child_process.exec() does:
// see https://github.com/joyent/node/blob/937e2e351b2450cf1e9c4d8b3e1a4e2a2def58bb/lib/child_process.js#L589

function tryRunCmdP(cmd, opt = {}) {
  return new Promise((resolve, reject) => {
    let child;

    if (appconfig.isWindows()) {
      let arg = cmd.split(/\s+/);
      let exe = arg.shift();
      child = spawn(exe, arg, opt);
    } else {
      child = spawn('/bin/sh', ['-c', cmd], opt);
    }
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    child.on('error', () => {
      console.log('ERR: Error run: ' + cmd);
      reject({ message: 'Error run: ' + cmd });
    });

    child.on('exit', code => {
      if (code) {
        console.log('ERR: ' + util.inspect(hut.getCmdErrObj(code, stderr, cmd)));
        reject(hut.getCmdErrObj(code, stderr, cmd));
      } else {
        resolve(stdout);
      }
    });
  });
}

function installNodeModulesP(folder) {
  let cmd = appconfig.getNpmInstallStr();

  try {
    if (!folder) throw { message: `Directory with node_modules not defined!` };
    if (!fs.existsSync(folder)) throw { message: `Directory not found: ${folder}` };

    let packagejson = path.join(folder, 'package.json');
    if (!fs.existsSync(packagejson)) throw { message: `File not found: ${packagejson}` };

    let needInstall;
    let dep = fut.readJsonFileSync(packagejson).dependencies;
    if (dep) {
      Object.keys(dep).forEach(name => {
        if (!fs.existsSync(path.join(folder, 'node_modules', name))) needInstall = true;
      });
    }
    return needInstall ? tryRunCmdP(cmd, { cwd: folder }) : Promise.resolve();
  } catch (err) {
    console.log('ERR: installNodeModules ' + cmd + '. ' + err.message);
    return Promise.reject({ message: 'installNodeModulesP: ' + err.message });
  }
}

function getToolPath(toolname) {
  return appconfig.get(toolname) || toolname;
}

function forkChilds(arr) {
  if (!arr || !util.isArray(arr)) return;
  arr.forEach(item => {
    if (item.module) {
      forkModule(item.module, item.args || []);
    }
  });
}

function forkModule(module, args) {
  if (!fs.existsSync(module)) {
    console.log('', 'Module not exists:'+module, 'WRAPPER');
    return;
  }

  let ps = fork(module, args);
  if (!ps) {
    console.log('', 'Fork error!', module);
    return;
  }

  ps.on('close', code => {
    if (code) console.log('', 'Exit code=' + code, module);
  });
}
