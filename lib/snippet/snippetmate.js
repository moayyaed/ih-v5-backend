/**
 * snippetmate.js
 *
 */
const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const snippetProps = ['snipuse', 'snipperiod', 'snipid'];

class Snippetmate {
  constructor(engine) {
    this.engine = engine;
    this.dm = engine.dm;

    // Событие сохранения кода сниппета
    // Если код используется - нужно перезапустить с новым кодом
    this.dm.on('saved:snippet', snipid => {
      const file = appconfig.getSnippetFilename(snipid);
      this.engine.updateSnippet(snipid, file);
    });

    // Саму таблицу snippets не слушаем
    // Добавление кода сниппета без привязки роли не играет
    // Удаление сниппета не выполняется, если есть привязки

    // Слушать события изменения таблиц, связанных с устройствами и глобальными переменными
    // Если меняют привязку к сниппету (snipuse, snipperiod, snipid )
    this.dm.on('updated:globals', docs => {
      this.updated(docs, { global: 1 });
    });

    this.dm.on('removed:globals', docs => {
      // Удалены переменные - если были связаны со сниппетами - удалить экземпляр сниппета
      docs.forEach(doc => this.engine.removeItem(doc._id));
    });

    this.dm.on('updated:device', docs => {
      this.updated(docs, { global: 0 });
    });

    this.dm.on('removed:device', docs => {
      docs.forEach(doc => this.engine.removeItem(doc._id));
    });
  }

  /**
   * По всем устройствам и глобальным переменным - если исп сниппет - найти его и записать в массив
   * Берутся, если snipuse && snipid
   * Если файла со скриптом нет - err = 'No file <file>'
   * @return {Array of Object} [{did, snipid, file, period, global, err}, ..]
   */
  async start() {
    const glDocs = getDocArray(await this.dm.dbstore.get('globals', {}), { global: 1 });
    const dvDocs = getDocArray(await this.dm.dbstore.get('devices', {}), { global: 0 });
    return [...glDocs, ...dvDocs];
  }

  updated(docs, opt) {
    docs.forEach(doc => {
      if (doc.$set) {
        const changedProps = hut.arrayIntersection(Object.keys(doc.$set), snippetProps);
        console.log('Snippetmate updated changedProp' + util.inspect(changedProps));
        if (changedProps.length) {
          if (changedProps.includes('snipuse') && doc.$set.snipuse == 0) {
            // больше не используется
            this.engine.removeItem(doc._id);
          } else {
            const upDoc = getSnippetSettingsFromDoc(Object.assign({}, doc, doc.$set), opt);
            console.log('updated upDoc ' + util.inspect(upDoc));
            this.engine.updateItem(upDoc);
          }
        }
      }
    });
  }
}

function getDocArray(docs, opt) {
  const res = [];
  docs.forEach(doc => {
    const item = getSnippetSettingsFromDoc(doc, opt);
    if (item) res.push(item);
  });
  return res;
}

function getSnippetSettingsFromDoc(doc, opt) {
  if (!doc.snipuse || !doc.snipid) return;

  // Проверить, что файл существует
  const file = appconfig.getSnippetFilename(doc.snipid);
  const err = !fs.existsSync(file) ? 'No file ' + file : '';
  return { did: doc._id, snipid: doc.snipid, file, period: doc.snipperiod, err, ...opt };
}

module.exports = Snippetmate;
