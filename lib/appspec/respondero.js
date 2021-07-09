/**
 * vsresponder.js
 * Объект для формирования сообщений изнутри visscript
 * 
 */

const util = require('util');

// const hut = require('../utils/hut');
const servercommands = require('./servercommands');

class Respondero {
  constructor(clid, holder) {
    this.holder = holder;
    this.clid = clid;
  }

  
  gotoLayout(layoutId, frameObj) {
    const resObj = servercommands.gotoLayout(layoutId, frameObj);
    if (!resObj || typeof resObj == 'string') {
      console.log('ERROR: gotoLayout for '+layoutId+', '+util.inspect(frameObj)+' error: '+resObj)
      return;
    }
    this.holder.emit('wssend', this.clid, resObj); 
    /*
    console.log('gotoLayout START')
    // Сформировать сообщение
    const resObj = { method: 'servercommand', command: 'gotolayout', id: layoutId };
    if (frameObj) {
      Object.keys(frameObj).forEach(frame => {
        resObj.target_frame = frame;
        resObj.target_container_id = frameObj[frame];
      })
    }
    */

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
   
   
  }
}

module.exports = Respondero;