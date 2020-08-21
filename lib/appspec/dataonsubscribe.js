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
  let id;
  switch (event) {
    case 'layout':
    case 'container':
      id = event;
      uppobj = await projectdata.getCachedUpProjectObj({ id, nodeid: key });
      // console.log('WARN: formMessageOnSub '+event+' uppobj'+util.inspect(uppobj));

      // Для контейнера - отправить изменения переменных, связанных с устройствами и globals из changed
      return formChangedForContainer(changed, uppobj.data);
    default:
  }
}

function formChangedForContainer(changed, uppobj) {
  if (!uppobj || !changed) return;
  const res = {};

  changed.forEach(chItem => {
    if (uppobj[chItem.did] && uppobj[chItem.did][chItem.prop]) {
      /*
      const varArr = uppobj[chItem.did][chItem.prop];
      varArr.forEach(varItem => {      
        if (!res) res = {};
        if (!res[varItem.el]) res[varItem.el] = {};  
        if (varItem.varname) {  // Для template {el, varname} - отправляется имя переменной шаблона
            res[varItem.el][varItem.varname] = chItem.value; // {template_1:{"state3":16,"state1":93}}

        } else {  // Простые элементы  {el} - отправляется объект со свойствами {did:{}}
          if (!res[varItem.el][chItem.did]) res[varItem.el][chItem.did] = {};
          res[varItem.el][chItem.did][chItem.prop] = chItem.value; //  {rectangle_1:{d002:{value:42, error:0}}}
        }
      }); 
      */
      const did = chItem.did;
      const prop = chItem.prop;
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
