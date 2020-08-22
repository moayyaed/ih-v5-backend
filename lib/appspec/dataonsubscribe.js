/**
 *  dataonsubscribe.js
 *  Формирует данные по подписке
 */

const util = require('util');
// const dm = require('../datamanager');
// const dataformer = require('../api/dataformer');
const projectdata = require('../appspec/projectdata');

async function formMessageOnSub(event, key, changed, holder) {
  let uppobj;
  switch (event) {
    case 'layout':
    case 'container':
      uppobj = await projectdata.getCachedUpProjectObj({ id: event, nodeid: key });

      // Для контейнера - отправить изменения переменных, связанных с устройствами и globals из changed
      return formChangedForContainer(changed, uppobj.data);
    default:
  }
}

function formChangedForContainer(changed, uppobj) {
  if (!uppobj || !changed) return;
  let res;

  changed.forEach(chItem => {
    if (uppobj[chItem.did] && uppobj[chItem.did][chItem.prop]) {
      const did = chItem.did;
      const prop = chItem.prop;
      if (!res) res = {};
      if (!res[did]) res[did] = {};
      res[did][prop] = chItem.value;
    }
  });
  // console.log('WARN: formChangedForContainer res='+util.inspect(res));

  return res;
}

module.exports = {
  formMessageOnSub
};
