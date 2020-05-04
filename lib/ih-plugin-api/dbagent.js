/*
 * Copyright (c) 2019 Intra LLC
 * MIT LICENSE
 *
 * Модуль для связи с БД. Возвращает pool, с которым дальше работает plugin
 */

// const util = require('util');
const mysql = require('mysql');

module.exports  =  function (opt) {
  opt = opt || {};
  const dbOpts = {
    connectionLimit: 10,
    host: opt.host || 'localhost',
    port: opt.port || 3306,
    user: opt.user || 'root',
    password: opt.password || 'intrahousemysql',
    database: opt.dbname || 'ihdb'
  };

  return mysql.createPool(dbOpts);
}
