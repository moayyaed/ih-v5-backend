/*
 * Copyright (c) 2019 Intra LLC
 * MIT LICENSE
 *
 * Connector локального плагина
 */

const util = require("util");

module.exports = Baseconnector;

/**
 * Constructor
 */
function Baseconnector() {
  if (!(this instanceof Baseconnector)) return new Baseconnector();

  let that = this;

  process.on("message", message => {
    if (typeof message != 'object') return;
    if (message.type) {
      that.emit(message.type, message);
    } else {
      that.emit('error', "Missing type in message: "+util.inspect(message));
    }
  });

  process.on("uncaughtException", err => {
    that.emit("error", "ERR: uncaughtException " + util.inspect(err));
  });

  process.on("unhandledRejection", (reason, promise) => {
    const txt =
      "Reason " + util.inspect(reason) + ". Promise " + util.inspect(promise);
    that.emit("error", "ERR: unhandledRejection! " + txt);
  });
}
util.inherits(Baseconnector, require("events").EventEmitter);

Baseconnector.prototype.send = function(message) { 
  process.send(message);
};

