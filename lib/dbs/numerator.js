/**
 * Компонент обеспечивает генерацию уникальных идентификаторов для таблиц по заданным правилам
 * Правила нумерации прописаны для каждой таблицы прописаны в tables.json
 * В одной коллекции может быть несколько таблиц 
 */

const util = require('util');
const dbstore = require('./dbstore');

const tableIds = {}; 
module.exports = {
  async  start(tables) {
    // "ruleID":{"pref":"p", "len":4}
   const rule = {"pref":"p", "len":3};
    // Найти существующие ключи, созданные по заданному правилу: prefix+от 2 до 5 чисел ()
    // const regexp = new RegExp("^p\\d{2,5}$");
    const regexp = new RegExp("^"+rule.pref+"\\d{"+String(rule.len-1)+","+String(rule.len+2)+"}$");
    const res= await dbstore.get('lists', {_id:regexp});
    console.log('res='+util.inspect(res))
    let next;
    if (res.length > 0 ) {
    const keys = res.map(item => item._id);

    // Среди ключей с максимальной длиной выбрать максимальное значение??

    let xkey = keys[0];
    let len = xkey.length;
    keys.forEach(el => {
      if (el.length > len) {
        xkey = el;
        len = xkey.length;
      } else if  (el.length == len && xkey < el){
        xkey = el;
      }
    });

    console.log('xkey='+xkey)
    next = rule.pref + String(Number(xkey.substr(1))+1);
  
    } else {
     next = rule.pref+ '1'.padStart(rule.len-1, '0');
    }
    console.log('next= '+next)
  }

}


