/**
 *  Объект для формирования команд от сервера клиенту
 *
 */

module.exports = {
  /** gotoLayout
   * Формирует команду перехода на экран 
   * @param {String} layoutId 
   * @param {Object || Array of Objects} - frames
   *      Если приходит от команды Goto Layout - то массив 
   *          [{target_frame: {id: "frame_1"}, container_id: {id: "vc033"},device_id: {id: "d0081"}}
   *      Если приходит от скрипта (responder.gotoLayout) то объект
   *          {frame_1:{container_id:vc001, device_id:d003 },frame_2:{.}}
   *         короткий вариант
   *          {frame_1:vc001,  }}
   * 
   * @return {
   *    method: "servercommand", 
   *    command: "gotolayout", 
   *    id: "l011", 
   *    context:{ 
   *        frames:{ 
   *           frame_1:{container_id: "vc033", device_id:"d003"}  
   *        }
   *     }
   *  }
   */
  gotoLayout(layoutId, frames) {
    const resObj = { method: 'servercommand', command: 'gotolayout', id: layoutId, context: {} };
    if (frames && typeof frames == 'object') {
      if (Array.isArray(frames)) {
        frames.forEach(item => {
          if (item.target_frame && item.target_frame.id && item.container_id && item.container_id.id) {
            if (!resObj.context.frames) resObj.context.frames = {};
            let device_id;
            let multichart_id;
            let timelinechart_id;
            if (item.device_id && item.device_id.id) device_id = item.device_id.id;
            if (item.multichart_id && item.multichart_id.id) multichart_id = item.multichart_id.id;
            if (item.timelinechart_id && item.timelinechart_id.id) timelinechart_id = item.timelinechart_id.id;

            resObj.context.frames[item.target_frame.id] = { container_id: item.container_id.id, device_id, multichart_id, timelinechart_id };
          }
        });
      } else {
        Object.keys(frames).forEach(frame => {
          if (!resObj.context.frames) resObj.context.frames = {};
          resObj.context.frames[frame] = typeof frames[frame] == 'object' ? {...frames[frame]} : { container_id: frames[frame] };
        });
      }
    }
    return resObj;
  }
};

/*
command: "gotolayout"
context: {frames: {frame_1: {container_id: "vc033", device: "d0081"}}}
frames: {frame_1: {container_id: "vc033", device: "d0081"}}
frame_1: {container_id: "vc033", device: "d0081"}
container_id: "vc033"
device: "d0081"
id: "l011"
method: "servercommand"
uuid: "S2soXrI_ZWM"
*/
