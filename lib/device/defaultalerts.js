/**
 * defaultalerts.js
 * Возвращает дефолтный объект для формирования алерта в зависимости от vtype
 */

module.exports = function(vtype) {
  switch (vtype) {
    case 'B':
      return {
        Norm: { theval: 0, level: 0, delay: 0 },
        Alert: { theval: 1, level: 0, delay: 0, toClose: 'stop' }
      };
    case 'N':
      return {
        LoLo: { theval: 0, level: 2, delay: 0, toClose: 'stop', use: 0 },
        Lo: { theval: 0, level: 1, delay: 0, toClose: 'stop', use: 0 },
        Norm: { theval: 0, level: 0, delay: 0 },
        Hi: { theval: 0, level: 1, delay: 0, toClose: 'stop', use: 0 },
        HiHi: { theval: 0, level: 2, delay: 0, toClose: 'stop', use: 0 }
      };

    default:
      // 'S'
      return {
        Norm: { theval: '', level: 0, delay: 0 },
        Alert: { theval: '', level: 0, delay: 0, toClose: 'stop' }
      };
  }
};
