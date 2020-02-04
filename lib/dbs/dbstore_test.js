// 1. Adjacency List («список смежности»): id - parent_id
// 2. Materialized Path («материализованный путь»)
// 3. Nested Sets («вложенные множества») left_key и right_key
// 4. Closure Table («таблица связей») Отдельная таблица связей, для элемента уровня n нужно n записей


const dbstore = require('./dbstore');

const cdo = {
  lists: {
    folder: 'jbase'
  },
  devices: {
    folder: 'jbase'
  },
  types: {
    folder: 'jbase'
  },
  users: {
    folder: 'private'
  },
  tokens: {
    folder: 'private'
  }
};

(async function test() {
  const dpath = '/var/lib/intrahouse-d/projects/project_D';
  dbstore.start(
    Object.keys(cdo).map(name => ({ name, filename: dpath + '/' + cdo[name].folder + '/' + name + '.db' }))
  );
  try {
  /*
  const newDocs = await dbstore.insert('lists', {list:'typegroup', name:'LUM', slug:'lum', parent:'YF52me1ttYau2vvL', order:200 });
  console.dir(newDocs);
  const newDocs2 = await dbstore.insert('lists', {list:'place', name:'Floor 2', slug:'floor2', parent:'bQ33iqICkMQfuLqz', order:200 });
  console.dir(newDocs2);
  */

  const updDocs = await dbstore.update('lists', {_id:'YF52me1ttYau2vvL'}, {$set:{order:128}}, { multi: true },);
  console.dir(updDocs);
 
 //  const updDocs = await dbstore.update('lists', {slug:'lum'}, {$set:{"order":1000}}, { multi: true },);
 //  console.dir(updDocs);


  const result = await dbstore.get('lists');
  console.dir(result);

  const r1 =  await dbstore.get('lists', {list:'place'});
  console.log('PLACE');
  console.dir(r1);

  const r2 =  await dbstore.get('lists', {list:'typegroup'});
  console.log('TYPEGROUP');
  console.dir(r2);
 } catch (e) {
  console.log('CATCH!');
  console.dir(e);

 }

})();

/** 
{
  "method": "update", // "insert"
  "type": "tree",
  "id":"devicesByPlace",
  "options":{"root":"devicesByPlace", "leaf":false},
  "payload":{"id":"4242", "title":"", "parent":"bQ33iqICkMQfuLqz", "order":50}
}

{
  "method": "get",
  "type": "tree",
  "id":"devicesByPlace"
}
*/


