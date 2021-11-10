/**
 *
 */

const util = require('util');
const child = require('child_process');
const fs = require('fs');

const appconfig = require('../appconfig');

module.exports = {
  forked: {},

  runTool(toolName, args, callback) {
    if (!this.forked[toolName]) {
      let ps;
      try {
        this.forked[toolName] = { status: 1, callbacks: [] };
        const modulepath = appconfig.getToolModulePath(toolName, 'index.js');
        if (!fs.existsSync(modulepath)) throw { message: 'Not found ' + modulepath };

        this.forked[toolName].callbacks.push(callback);

        ps = child.fork(modulepath, args);
        if (!ps) throw { message: 'Error fork ' + modulepath };

        setTimeout(() => {
          this.stopTool(toolName);
        }, 2000); // TODO - таймаут может быть другой!

      } catch (e) {
        console.log('ERROR: tool '+toolName+': '+util.inspect(errStr));
        const errStr = util.inspect(errStr);
        this.rejectAll(toolName, errStr);
        this.stopTool(toolName);
        return;
      }

      this.forked[toolName].ps = ps;

      ps.on('message', m => {
        this.resolveAll(toolName, m);
        this.stopTool(toolName);
      });

      ps.on('error', err => {
        this.rejectAll(toolName, 'Forked process '+toolName+' error: ' + util.inspect(err));
        this.stopTool(toolName);
      });

      ps.on('close', err => {
        this.rejectAll(toolName, 'Forked process '+toolName+' closed: ' + util.inspect(err));
        this.stopTool(toolName);
      });
    } else {
      this.forked[toolName].callbacks.push(callback);
    }
  },

  stopTool(toolName) {
    if (this.forked[toolName]) {
      if (this.forked[toolName].ps) {
        this.forked[toolName].ps.kill('SIGTERM');
      }
      this.forked[toolName] = '';
    }
  },

  rejectAll(toolName, err) {
    if (this.forked[toolName] && this.forked[toolName].callbacks) {
      this.forked[toolName].callbacks.forEach(cb => {
        cb(err);
      });
    }
  },

  resolveAll(toolName, res) {
    this.forked[toolName].callbacks.forEach(cb => {
      cb(null, res);
    });
  }
};
