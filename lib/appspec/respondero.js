/**
 * vsresponder.js
 * Объект для формирования сообщений изнутри visscript
 * 
 */

const util = require('util');

const hut = require('../utils/hut');

class Respondero {
  constructor(clid, holder) {
    this.holder = holder;
    this.clid = clid;
  }

  
  gotoLayout(layoutId, frameObj) {
    console.log('gotoLayout START')
    // Сформировать сообщение
    const resObj = { method: 'servercommand', command: 'gotolayout', id: layoutId };
    if (frameObj) {
      Object.keys(frameObj).forEach(frame => {
        resObj.target_frame = frame;
        resObj.target_container_id = frameObj[frame];
      })
    }
    /*
    if (mes.targetFrameTable && mes.targetFrameTable[0] && mes.targetFrameTable[0].target_frame) {
      res.toSend.target_frame = mes.targetFrameTable[0].target_frame.id;
      res.toSend.target_container_id = mes.targetFrameTable[0].target_container_id.id;
    }
    command: "gotolayout"
id: "l024"
method: "servercommand"
target_container_id: "vc033"
target_frame: "container_2"
uuid: "kAE7IyyLZ"
    */

    // Передать в wsserver
    this.holder.emit('wssend', this.clid, resObj); 
    console.log('gotoLayout END')
  }
}

module.exports = Respondero;