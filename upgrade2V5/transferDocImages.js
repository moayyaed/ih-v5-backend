/**
 *
 */

const util = require('util');
const fs = require('fs');

const source1 = '/opt/ih-docs-intrascada/backend/base/docs/files';
const source2 = '/opt/ih-docs-intrahouse/backend/base/docs/files';

const target = '/var/lib/ih-docs/projects/ih_systems_docs_server/docimages';

copyFrom(source1);
// copyFrom(source2);

function copyFrom(src) {
  const dirs = fs.readdirSync(src);
  const folders = [];
  dirs.forEach(one => {
    if (fs.statSync(src+'/'+one).isDirectory()) {
      folders.push(src+'/'+one);
    }
  });
  console.log('folders='+util.inspect(folders));

  folders.forEach(folder => {
    const files = fs.readdirSync(folder);
    files.forEach(file => {
      if (isImgFile(file)) {
        console.log('Copy file '+folder+'/'+file)
        fs.copyFileSync(folder+'/'+file, target+'/'+file);
      }
    })
  });
}

function isImgFile(filename) {
  return filename ? ['.png', '.svg', '.jpg', '.jpeg'].some(item => filename.endsWith(item)) : false;
}
