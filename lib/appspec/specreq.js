const linkmethods = require('./linkmethods');

/**
 *  Обработка запросов для типов из spec: пока type:link
 *
 * @param {Object} query - объект запроса
 * @return {Object}: {data}
 */
async function processSpec(query) {
  const { type, method } = query;
  if (type == 'link') {
    const apiFun = linkmethods[method];
    if (!apiFun) throw { error: 'SORTERR', message: 'Unexpected type or method for type:link' };
    return apiFun(query);
  }

  throw { error: 'SOFTERR', message: 'Unexpected type: ' + type };
}

module.exports = {
  processSpec
};
