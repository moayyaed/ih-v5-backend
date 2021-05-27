/*
 * wrappers.js
 */

const fs = require('fs');
const util = require('util');
const spawn = require('child_process').spawn;
const fork = require('child_process').fork;
const exec = require('child_process').exec;
const path = require('path');

const hut = require('./hut');
const fut = require('./fileutil');
const sysinfo = require('./sysinfo');

const appconfig = require('../appconfig');

exports.zipP = zipP;
exports.zipfileP = zipfileP;
exports.unzipP = unzipP;
exports.rsyncP = rsyncP;
exports.cpP = cpP;
exports.installNodeModulesP = installNodeModulesP;
exports.installOneNodeModule = installOneNodeModule;
exports.tryRunCmdP = tryRunCmdP;

exports.forkChilds = forkChilds;
exports.getServiceStatus = getServiceStatus;

/**
 *  Wrapper for zip command
 *   exclude:["temp", "operative"]
 */
function zipP(options) {
  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
    if (!fs.existsSync(options.src)) throw { message: `Directory not found ${options.src}` };
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }

  let cmd;
  if (sysinfo.isWindows()) {
    // 7z.exe a -tzip C:\Users\archive.zip C:\Users\work -mx0 -xr!http -xr!Alarm
    
    cmd = getToolPath('zip') + ' a -tzip ' + options.dest + ' '+options.src+' ';
    // cmd = getToolPath('zip') + ' a -tzip ' + options.dest + ' * -mx0 ';
    cmd += excludeStrWin(options.exclude);
    // if (options.exclude) cmd += ' -x ' + options.exclude;
    // cmd = getToolPath('zip') + ' a ' + options.dest + ' * -r'; // -r  recursion
  } else {
    cmd = 'zip -r ' + options.dest + ' ./* ';
    cmd += excludeStrLin(options.exclude);
    // FOR LINUX -x  "dir1/*"  "dir2/*"
    // if (options.exclude) cmd += ' -x ' + options.exclude;
  }
  console.log('INFO: ' + cmd);
  return tryRunCmdP(cmd, { cwd: options.src });

  function excludeStrWin(excludeArr) {
    // FOR WINDOWS -xr!dir1  -xr!dir2
    if (!excludeArr || !Array.isArray(excludeArr)) return '';
    return excludeArr.reduce((res, item) => res + '-xr!' + item + ' ', ' ');
  }

  function excludeStrLin(excludeArr) {
    // FOR LINUX -x  "dir1/*"  "dir2/*"
    if (!excludeArr || !Array.isArray(excludeArr)) return '';

    return excludeArr.reduce((res, item) => res + ' "./' + item + '/*" ', ' -x ');
  }
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
  if (sysinfo.isWindows()) {
    cmd = getToolPath('zip') +  ' a -tzip ' + options.dest + ' ' + options.src;
    console.log('INFO: ' + cmd);
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
  if (sysinfo.isWindows()) {
    dest = options.dest ? ` -o${options.dest}` : ''; // -o целевая папка
    cmd = getToolPath('unzip') + ' x -y ' + options.src + dest;
  } else {
    dest = options.dest ? ` -d ${options.dest}` : ''; // -d целевая папка
    cmd = `unzip -o  ${options.src} ${dest}`; // -o  overwrite files without prompting
  }
  console.log('INFO: ' + cmd);
  return tryRunCmdP(cmd);
}

/**
 *  Wrapper for cp command
 */
function cpP(options) {
  let cmd;
  if (sysinfo.isWindows()) {
    cmd = `Xcopy /E /Y ${options.src} ${options.dest}`;
  } else {
    cmd = `cp -r ${options.src}/* ${options.dest}/`; // -r  recursion
  }

  try {
    if (!options.src) throw { name: 'SoftError', message: '"src"  directory is missing from options' };
  } catch (err) {
    return Promise.reject({ message: 'Before run ' + cmd + ' ' + err.message });
  }
  console.log('INFO: ' + cmd);
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

    if (sysinfo.isWindows()) {
      // Чтобы использовать cwrsync - пути нужны Unix и вместо C:\\ -> /cygdrive/C/....
      // используется просто xcopy - без backup

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
  let cmd = (sysinfo.isWindows() ? getToolPath('rsync') : 'rsync') + ' ';

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
    for (let i = 0; i < options.exclude.length; i++) {
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

function tryRunCmdP(cmd, opt = {}, ignoreExitCode) {
  return new Promise((resolve, reject) => {
    let child;

    if (sysinfo.isWindows()) {
      let arg = cmd.split(/\s+/);
      let exe = arg.shift();
      opt.shell = true;
      child = spawn(exe, arg.join(' '), opt);
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
      if (code && !ignoreExitCode) {
        console.log('ERROR: ' + util.inspect(hut.getCmdErrObj(code, stderr, cmd)));
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
    // if (!fs.existsSync(folder)) throw { message: `Directory not found: ${folder}` };
    if (!fs.existsSync(folder)) return Promise.resolve();

    let packagejson = path.join(folder, 'package.json');
    if (!fs.existsSync(packagejson)) return Promise.resolve();

    let needInstall;
    let dep = fut.readJsonFileSync(packagejson).dependencies;
    if (dep) {
      Object.keys(dep).forEach(name => {
        if (!fs.existsSync(path.join(folder, 'node_modules', name))) {
          console.log('WARN: installNodeModules: try install ' + name);
          needInstall = true;
        }
      });
    }
    return needInstall ? tryRunCmdP(cmd, { cwd: folder }) : Promise.resolve();
  } catch (err) {
    console.log('ERROR: installNodeModules ' + cmd + '. ' + err.message);
    return Promise.reject({ message: 'installNodeModulesP: ' + err.message });
  }
}

function installOneNodeModule(folder, name) {
  let cmd = appconfig.getNpmInstallStr();

  try {
    if (!folder || !name) throw { message: `Directory with node_modules not defined!` };
    if (!fs.existsSync(folder)) return Promise.resolve();

    cmd += ' ' + name + ' --save';
    console.log('INFO: working dir: ' + folder);
    console.log('INFO: ' + cmd);

    return tryRunCmdP(cmd, { cwd: folder });
  } catch (err) {
    console.log('ERROR: installOneNodeModule ' + cmd + '. ' + err.message);
    return Promise.reject({ message: 'installOneNodeModule: ' + err.message });
  }
}

// Это только для Windows
function getToolPath(toolname) {
  if (toolname == 'zip' || toolname == 'unzip') toolname = '7z';
  // return appconfig.get(toolname) || toolname;
  return path.join(appconfig.get('syspath'), 'tools', toolname+'.exe');
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
    console.log('', 'Module not exists:' + module, 'WRAPPER');
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

async function getServiceStatus() {
  return new Promise((resolve, reject) => {
    exec('systemctl list-unit-files --type service', (error, stdout, stderr) => {
      if (error) {
        console.log('Ошибка при выполнении команды systemctl!\n' + stderr);
        reject();
      } else {
        const services = [];
        if (stdout) {
          const strs = stdout.split('\n'); // intrahouse-dtest1.service              enabled
          strs.forEach(str => {
            if (str) {
              const arr = str.split(/\s+/);

              if (arr && arr.length > 1) {
                // services.push({ name: arr[0].split('.')[0], status: arr[1] });
                services.push({ name: arr[0], status: arr[1] });
              }
            }
          });
        }
        resolve(services);
      }
    });
  });
}
