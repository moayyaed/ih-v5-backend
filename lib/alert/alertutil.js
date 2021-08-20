/**
 * alertutil.js
 *
 */

const devicelogger = require('../device/devicelogger');
const logconnector = require('../log/logconnector');

/**
 * Запись событий алерта в журналы:
 *  - старт
 *  - стоп
 *  - квитирование/снятие
 *  - закрытие отдельно не пишется
 *
 * @param {Object} aleData
 * @param {String} event
 * @param {ts} ts
 */
function addLogs(aleData, event, ts) {
  const { did, prop, txt, level, tags, location, devTitle, username } = aleData;
  const logObj = { did, prop, ts, sender: 'alert' };
  let pref = '';
  if (event == 'ack') {
    pref = 'Квитировано, оператор ' + username + ': ';
  } else if (event == 'deack') {
    pref = 'Квитирование снято: ';
  }
  devicelogger.addLog(did, { ...logObj, level, txt: pref + txt });
  logconnector.addLog('mainlog', { ...logObj, txt: pref + txt, level, tags, location });
}

function formNormTxt(aleData, propTitle) {
  if (aleData.message) return aleData.message ? aleData.message : propTitle + ': норма';
}

function formAlertTxt(aleData, propTitle) {
  const delayStr = aleData.delay > 0 ? ' в течение ' + aleData.delay + ' сек' : '';
  if (aleData.message) return aleData.message + delayStr;

  switch (aleData.aruleId) {
    case 'Alert':
      return propTitle + ': cработка' + delayStr;

    case 'LoLo':
      return propTitle + ': нижний аварийный уровень' + delayStr;
    case 'Lo':
      return propTitle + ': нижний предупредительный уровень ' + delayStr;
    case 'Hi':
      return propTitle + ': верхний предупредительный уровень ' + delayStr;
    case 'HiHi':
      return propTitle + ': верхний аварийный уровень' + delayStr;
    case 'Norm':
      return propTitle + ': норма ' + delayStr;

    default:
  }
}

function binAlert(val, rules) {
  return rules.Alert && val == rules.Alert.theval
    ? { aruleId: 'Alert', ...rules.Alert }
    : { aruleId: 'Norm', ...rules.Norm };
}

function hiLoAlert(val, rules) {
  const LoRule = rid => rules[rid] && rules[rid].use && val <= rules[rid].theval;
  const HiRule = rid => rules[rid] && rules[rid].use && val >= rules[rid].theval;

  if (LoRule('LoLo')) return { aruleId: 'LoLo', ...rules.LoLo };
  if (HiRule('HiHi')) return { aruleId: 'HiHi', ...rules.HiHi };
  if (LoRule('Lo')) return { aruleId: 'Lo', ...rules.Lo };
  if (HiRule('Hi')) return { aruleId: 'Hi', ...rules.Hi };
  return { aruleId: 'Norm', ...rules.Norm };
}

module.exports = {
  addLogs,
  formAlertTxt,
  formNormTxt,
  binAlert,
  hiLoAlert
};
