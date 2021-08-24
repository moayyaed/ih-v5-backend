const util = require('util');


class Scenedevo {
  constructor(d, agent) {
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
          if (prop == 'dn') return dobj.dn;
          if (prop == 'name') return dobj.name;
          
          if (cherryFun[prop]) {
            return function(...args) {
              const result = cherryFun[prop].apply(dobj, args);
              // agent.debugWrap('Cherry ' + prop + JSON.stringify(args) + ' -> ' + JSON.stringify(result));
              return result;
            };
          }
          

          if (dobj.hasProp(prop)) {
            const result = dobj.getPropValue(prop);
            agent.debugWrap(dn+'.' + prop+'='+result);
            return result;
        
          }

          if (dobj.hasCommand(prop)) {
            if (dobj.isCommand(prop)) {
              agent.debugWrap( 'Exec ' + dn+'.'+prop);
              return function() {
                dobj.doCommand(prop);
              };
            }

            agent.debugWrap(dobj.dn+ ' device common function: ' + prop);

            const origMethod = dobj[prop];
            return function(...args) {
              const result = origMethod.apply(dobj, args);
              const strResult = result ? ' -> ' + util.inspect(result) : '';
              agent.debugWrap(prop + util.inspect(args) + strResult);
              return result;
            };  
          }

        }
      }
    );
  }
}

module.exports = Scenedevo;
