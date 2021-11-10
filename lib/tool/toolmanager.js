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
      this.forked[toolName] = { status: 1, callbacks: [] };
      const modulepath = appconfig.getToolModulePath(toolName, 'index.js');
      if (!fs.existsSync(modulepath)) {
        this.rejectAll(toolName, 'Not found ' + modulepath);
        return;
      }

      this.forked[toolName].callbacks.push(callback);

      const ps = child.fork(modulepath, args);
      setTimeout(() => {
        this.stopTool(toolName);
      }, 2000); // TODO - таймаут может быть другой!

      if (!ps) {
        this.rejectAll(toolName, 'Error fork ' + modulepath);
        this.forked[toolName] = '';
        return;
      }
      this.forked[toolName].ps = ps;

      ps.once('message', m => {
        this.resolveAll(toolName, m);
        this.stopTool(toolName);
      });

      ps.once('error', err => {
        this.rejectAll(toolName, 'Forked process error: ' + util.inspect(err));
        this.stopTool(toolName)
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
    this.forked[toolName].callbacks.forEach(cb => {
      cb(err);
    });
  },

  resolveAll(toolName, res) {
    this.forked[toolName].callbacks.forEach(cb => {
      cb(null, res);
    });
  }
};
