/**
 * build.js
 */

 const util = require('util');
 const path = require('path');

 const workpath = path.resolve(process.cwd());

 console.log('Build has started. Current directory = '+workpath)

 const src = path.join(workpath, '../..');

 console.log('Build has started. src directory = '+src);
