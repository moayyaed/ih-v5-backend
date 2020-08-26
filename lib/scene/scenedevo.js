// const util = require('util');

class Scenedevo {
  constructor(d, sceneId) {
    const dobj = d;
    return new Proxy(
      {},
      {
        set: (target, prop, value) => {
          dobj.setValue(prop, value); // Присваивание возможно только свойствам с op=rw/par через функцию-обработчик
          return true;
        },

        get: (target, prop, receiver) => {
      
          const agent = dobj.agent;
          if (dobj.hasCommand(prop)) {
            return function () { 
              agent.doCommand(dobj, prop, { src: sceneId });
            };
          }
          
          if (dobj.hasProp(prop)) {
            return dobj.getPropValue(prop);
          }
          
          // Также нужны getMin, getMax,...
          // И функции из Cherry -  isOn(), isOff(),....
        }
      }
    );
  }
}

module.exports = Scenedevo;
