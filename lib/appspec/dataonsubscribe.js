/**
 *  dataonsubscribe.js
 *  Формирует данные по подписке 
 */

// const dm = require('../datamanager');
// const dataformer = require('../api/dataformer');
const projectdata = require('../appspec/projectdata');

async function formMessageOnSub(event, key, changed, holder) {
 
  let uppobj;
  switch (event) {
    case 'container':
      // uppobj = await dm.getCachedData({ type: 'uppobj', id: 'container', nodeid: key, method: 'get' }, getUpPobj);
      uppobj = await projectdata.getCachedUpProjectObj({ id: 'container', nodeid: key });
    
      // Для контейнера - отправить изменения переменных, связанных с устройствами из changed
      return formChangedForContainer(changed, uppobj.data);
    default:
  }
}

function formChangedForContainer(changed, uppobj) {
  if (!uppobj || !changed) return;
  let res;
  
  changed.forEach(chItem => {
    if (uppobj[chItem.did] && uppobj[chItem.did][chItem.prop]) {
      const varArr = uppobj[chItem.did][chItem.prop];
      varArr.forEach(varItem => {
        if (!res) res = {};
        res[varItem.el] = {[varItem.varname]:chItem.value};
      });
    }
  });
  
  return res;
}




module.exports = {
  formMessageOnSub
}