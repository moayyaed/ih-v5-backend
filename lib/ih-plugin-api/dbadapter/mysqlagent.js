/**
 *  mysqlagent.js
 */

const mysql = require('mysql');

module.exports = Dbagent;

function Dbagent() {
  if (!(this instanceof Dbagent)) return new Dbagent();
}

Dbagent.prototype.connectDb = function(opt) {
  opt = opt || {};
  const dbOpts = {
    connectionLimit: 10,
    host: opt.host || 'localhost',
    port: opt.port || 3306,
    user: opt.user || 'root',
    password: opt.password || 'ihmysql',
    database: opt.dbname || 'ihdb'
  };

  this.poolDb = mysql.createPool(dbOpts);

  if (this.poolDb) {
    const self = this;
    this.poolDb.on('error', err => {
      err.errtype = 'DB';
      self.emit('error', err);
    });
  }
};

Dbagent.prototype.queryDb = function(qstr) {
  return new Promise((resolve, reject) => {
    if (!this.poolDb) {
      return reject({ message: 'No dbconnection!' });
    }

    this.poolDb.query(qstr, (err, result, fields) => (err ? reject(err) : resolve(result)));
  });
};

Dbagent.prototype.queryInsertDb = function(qstr, values) {
  return new Promise((resolve, reject) => {
    if (!this.poolDb) {
      return reject({ message: 'No dbconnection!' });
    }

    this.poolDb.query(qstr, [values],  (err, result) => (err ? reject(err) : resolve(result)));
  });
};
