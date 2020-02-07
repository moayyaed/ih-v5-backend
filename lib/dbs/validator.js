/**
 * validator.js
 *
 */

function checkInsert(doc, valObj) {
  if (!valObj) return true;
  if (!doc) throw { err: 'ERRINSERT', message: 'No doc to insert!' };
  if (typeof doc != 'object') throw { err: 'ERRINSERT', message: 'Expected object type for insertion!' };

  if (valObj.required && Array.isArray(valObj.required)) {
    valObj.required.forEach(prop => {
      if (doc[prop] == undefined) throw { doc, message: 'Field "' + prop + '" is required!' };
    });
  }

  return checkProperties(doc, valObj);
}

function checkUpdate(doc, valObj) {
  if (!valObj) return true;
  return checkProperties(doc, valObj);
}

function checkProperties(doc, valObj) {
  if (!valObj || !valObj.properties) return true;
  Object.keys(doc).forEach(prop => {
    if (valObj.properties[prop]) {
      const rule = valObj.properties[prop];

      if (rule.type != typeof doc[prop])
        throw { doc, message: 'Field ' + prop + rule.description };
      if (!rule.empty && !doc[prop])
        throw { doc, message: 'Field ' + prop + rule.description };
    }
  });
  return true;
}

module.exports = {
  checkInsert,
  checkUpdate
};
