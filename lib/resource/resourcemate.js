/**
 *
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');

const resutil = require('./resutil');
const projectutil = require('./projectutil');

class Resourcemate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
    this.folder = appconfig.getImagePath();
  }

  async start() {
    this.revising = true;
    // 
    const projectspath = appconfig.get('projectspath');
    await this.dm.reviseTableWithFolder('projects', async docs => projectutil.syncProjects(docs, projectspath));

    await this.dm.reviseTableWithFolder('images', async docs => resutil.syncImages(docs, this.folder));
    this.revising = false;

    // Слушать папку с картинками - не получается, нужно при получении формировать элемент таблицы
    /*
    fs.watch(this.folder, (eventType, filename) => {
      if (this.revising) return;
      this.processWatchResult(eventType, filename);
    });
    */

  }

  // eventType :'rename' - Файл добавлен или удален
  // eventType :'change' - Файл изменен - не реагируем (time, size??)
  async processWatchResult(eventType, filename) {
    if (eventType != 'rename') return;
    if (!filename) {
      console.log(`WARN: fs.watch folder ${this.folder}, event type ${eventType}. Filename not provided - skipped`);
      return;
    }
    if (!resutil.isImage(filename)) return;

    const filepath = this.folder + '/' + filename;

    try {
      if (fs.existsSync(filepath)) {
        // Проверить существование в любом случае
        this.upsert(filename);
      } else {
        // Файл удален - редактировать запись в таблице, если она есть
        this.updateWhenMissing(filename);
      }
    } catch (err) {
      const mess = `Watch :${filepath}, event type: ${eventType}, filename: ${filename}. Error ` + util.inspect(err);
      console.log('ERROR: ' + mess);
    }
  }

  async upsert(docId) {
    const doc = await this.dm.dbstore.findOne('images', { _id: docId });
    if (!doc) {
      // Добавить новую запись
      const newdoc = resutil.newImageRecord(docId);
      await this.dm.insertDocs('images', [newdoc]);
    } else if (doc.miss) {
      // Редактировать, если была пометка об отстутствии
      doc.$set = { miss: 0 };
      await this.dm.updateDocs('images', [doc]);
    }
  }

  async updateWhenMissing(docId) {
    const doc = await this.dm.dbstore.findOne('images', { _id: docId });
    if (doc) {
      doc.$set = { miss: 1 };
      await this.dm.updateDocs('images', [doc]);
    } // записи нет - ничего не делать
  }
}

module.exports = Resourcemate;
