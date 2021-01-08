const util = require('util');

class Scenedevo {
  constructor(d, sceneId, agent) {
    const dobj = d;
    return new Proxy(
      {},
      {
        set: (target, prop, value) => {
          dobj.setValue(prop, value); // Присваивание возможно только свойствам с op=rw/par через функцию-обработчик
          return true;
        },

        get: (target, prop, receiver) => {
          if (dobj.hasProp(prop)) {
            agent.debug(sceneId,'get ' + prop);
            return dobj.getPropValue(prop);
          }

          if (dobj.hasCommand(prop)) {
            if (dobj.isCommand(prop)) {
              
              agent.debug(sceneId,'COMMAND ' + prop);
              return function() {
                dobj.doCommand(prop, { src: sceneId });
              };
            } 
           
            agent.debug(sceneId,'Function ' + prop);

            const origMethod = dobj[prop];
            return function (...args) {
                const result = origMethod.apply(dobj, args);
                agent.debug(sceneId, prop + JSON.stringify(args)
                    + ' -> ' + JSON.stringify(result));
                return result;
            };
          
          }

          // Также нужны getMin, getMax,...
          // И функции из Cherry -  isOn(), isOff(),....
        }
      }
    );
  }
}

module.exports = Scenedevo;
