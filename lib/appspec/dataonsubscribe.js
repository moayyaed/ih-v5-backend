/**
 *  dataonsubscribe.js
 *  Формирует данные по подписке 
 */

const dm = require('../datamanager');
const dataformer = require('../api/dataformer');

async function formMessageOnSub(event, key, changed, holder) {
 
  let uppobj;
  switch (event) {
    case 'container':
      uppobj = await dm.getCachedData({ type: 'uppobj', id: 'container', nodeid: key, method: 'get' }, getUpPobj);
    
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

async function getUpPobj(query) {
  const { id, nodeid } = query;
  const res = {};
  
  // Получить исходный объект
  const pobj = await dataformer.getCachedProjectObj(id, nodeid);
  if (!pobj || !pobj.elements) return {};

  // Вывернуть по did
  Object.keys(pobj.elements).forEach(el => {

    if (pobj.elements[el].type == 'template' && pobj.elements[el].links && typeof pobj.elements[el].links == 'object') {

      const links = pobj.elements[el].links;
      Object.keys(links).forEach(varname => {
        if (typeof links[varname] == 'object') {
          const did = links[varname].did;
          const prop = links[varname].prop;
          if (did && prop) {
            if (!res[did]) res[did] = {};
            if (!res[did][prop]) res[did][prop] = [];
            res[did][prop].push({ el, varname });
          }
        }
      });
    }
  });
  return res;
}


module.exports = {
  formMessageOnSub
}