
const util = require('util');
const fs = require('fs');
const path = require('path');

const Datastore = require('nedb');

/*
const appdir = path.resolve(process.cwd());
const syspath = path.join(appdir, '..');

const db = {};

const dbpath =  path.join(syspath, 'nedb');

const filename = dbpath+'/users.db';
console.log(filename);


db.users = new Datastore({ filename, autoload: true });


db.users.insert({username : "Boris", year: 1946});
*/