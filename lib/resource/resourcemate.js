/**
 * 
 */

const util = require('util');
const fs = require('fs');

const appconfig = require('../appconfig');
const hut = require('../utils/hut');
const resutils = require('./resutils');

class Resourcemate {
  constructor(engine, dm) {
    this.engine = engine;
    this.dm = dm;
  }

  async start() {
    this.revising = true;
    await this.dm.reviseTableWithFolder('images', resutils.syncImages);
    this.revising = false;
   

    // Слушать папку со скриптами, перегенерировать req и записи в scenes
    fs.watch(appconfig.getScriptPath(), (eventType, filename) => {
      if (this.revising) return;
      this.processWatchResult(eventType, filename);
    });

    return this.load();
  }

  async processWatchResult(eventType, filename) {
    if (!filename) {
      console.log(`fs.watch: event type is: ${eventType}, filename not provided!`);
      
    }
    /*
    if (!filename.endsWith('.js')) return;

    const filepath = appconfig.getScriptPath() + '/' + filename;
    const sceneId = filename.substr(0, filename.length - 3);

    // eventType :'rename' - Скрипт добавлен или удален
    // eventType :'change' - Скрипт изменен
    try {
      if (fs.existsSync(filepath)) {
        // Проверить существование в любом случае
        this.upsertScene(sceneId);
      } else {
        // Скрипт не существует - редактировать запись в таблице, если она есть!!
        this.updateWhenMissingScript(sceneId);
      }
    } catch (e) {
      const mess = `Watch :${filepath}, event type: ${eventType}, filename: ${filename}`;
      console.log('Error updating scene! ' + mess);
    }
    */
  }

  

  

  
  async load() {
    
  }
}

module.exports = Resourcemate;
