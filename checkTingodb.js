const util = require('util');
const Db = require('tingodb')().Db;

const db = new Db('/var/lib/intrahouse-d/projects/testproject/tingodb', {});
// Fetch a collection to insert document into
const collection1 = db.collection('collection1');
// Insert a single document
collection1.insert([{ hello: 'world_safe1' }, { hello: 'world_safe2' }], { w: 1 }, (err, result) => {
  if (!err) {
    console.log('insert RESULT: ' + util.inspect(result));
    // Fetch the document
    collection1.find({}).sort('_id').toArray((err1, item) => {
      if (!err1) {
        console.log('FIND RESULT: ' + util.inspect(item));
      } else {
        console.log('ERROR findOne! ' + util.inspect(err));
      }
    });
  } else {
    console.log('ERROR insert! ' + util.inspect(err));
  }
});
