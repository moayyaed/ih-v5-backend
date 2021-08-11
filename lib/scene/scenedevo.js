const util = require('util');


class Scenedevo {
  constructor(d, sceneId, agent) {
    const dobj = d;
    const dn = dobj.dn;
    const cherryFun = {
      isOn: () => dobj.state > 0,
      isOff: () => dobj.state == 0,
      setParam: (prop, val) => {
        dobj[prop] = val;
      }
    };

    
    return new Proxy(
      {},
      {
        set: (target, prop, value) => {
          dobj.setValue(prop, value); // Присваивание возможно только свойствам с op=rw/par через функцию-обработчик
          return true;
        },

        get: (target, prop, receiver) => {
         
          if (cherryFun[prop]) {
            return function(...args) {
              const result = cherryFun[prop].apply(dobj, args);
              agent.debug(sceneId, 'Cherry ' + prop + JSON.stringify(args) + ' -> ' + JSON.stringify(result));
              return result;
            };
          }

          if (dobj.hasProp(prop)) {
            const result = dobj.getPropValue(prop);
            agent.debug(sceneId, dn+'.' + prop+'='+result);
            return result;
            // agent.debug(sceneId, 'get ' + prop);
            // return dobj.getPropValue(prop);
          }

          if (dobj.hasCommand(prop)) {
            if (dobj.isCommand(prop)) {
              agent.debug(sceneId, 'Exec ' + dn+'.'+prop);
              return function() {
                dobj.doCommand(prop, { src: sceneId });
              };
            }

            agent.debug(sceneId, dobj.dn+ ' device common function: ' + prop);

            const origMethod = dobj[prop];
            return function(...args) {
              const result = origMethod.apply(dobj, args);
              agent.debug(sceneId, prop + JSON.stringify(args) + ' -> ' + JSON.stringify(result));
              return result;
            };
          }

        }
      }
    );
  }
}

module.exports = Scenedevo;
