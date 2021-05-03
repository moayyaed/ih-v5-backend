/**
 * defaultalerts.js
 * Возвращает дефолтный объект для формирования алерта в зависимости от vtype
 */


module.exports = function (vtype) {
  switch (vtype) {
    case 'B': return {
      'B_0': {theval:0, message:'OK',level:0, delay:0 },
      'B_1': {theval:1, message:'Alarm!',level:1, delay:0,toClose:'stop' }
  
    };
    case 'N': return {
      'N_LoLo': {theval:0, message:'Alarm!',level:3, delay:0,toClose:'stop', use:0 },
      'N_Lo': {theval:0, message:'Warning',level:1, delay:0,toClose:'stop', use:0 },
      'N_0': {theval:0, message:'OK',level:0, delay:0 },
      'N_Hi': {theval:0, message:'Warning',level:2, delay:0,toClose:'stop', use:0 },
      'N_HiHi': {theval:0, message:'Alarm!',level:4, delay:0,toClose:'stop', use:0 }
    };
    default: 
  }
}